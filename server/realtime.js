// ---------------------------------------------------------------------------
// Real-time multiplayer (Socket.io). One room per published map. The server owns
// the roster + health + kill validation; movement is client-reported and relayed
// (foundation-level). Validated PvP kills feed the Creator Reward Ledger.
// ---------------------------------------------------------------------------
import { Server } from "socket.io";
import { read, write } from "./db.js";
import { recordValidatedKill } from "./rewards.js";
import { uid } from "./antifarm.js";

const MAX_PLAYERS = Number(process.env.MAX_PLAYERS || 16);

// server-side weapon damage (mirror of client WEAPONS; head = instant kill)
const DMG = { m4: 26, ak: 30, mp5: 20, ump: 24, glock: 26, deagle: 58, pump: 90, awp: 120 };

/** map_id -> { matchId, players: Map<socketId, player> } */
const rooms = new Map();

export function getRoomCounts() {
  const out = {};
  for (const [mapId, room] of rooms) out[mapId] = room.players.size;
  return out;
}

function spawnsOf(map) {
  const s = (map.objects || [])
    .filter((o) => o.kind === "spawn" || o.kind === "team_spawn")
    .map((o) => ({ x: o.position[0], y: o.position[1] + 0.1, z: o.position[2], yaw: o.rotation?.[1] || 0, team: o.settings?.team || null }));
  return s.length ? s : [{ x: 0, y: 1, z: 0, yaw: 0, team: null }];
}

const publicPlayer = (p) => ({
  id: p.id, wallet: p.wallet, username: p.username, loadout: p.loadout,
  x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, hp: p.hp, alive: p.alive, moving: p.moving, aiming: p.aiming,
});

export function initRealtime(httpServer, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins.length ? allowedOrigins : true, methods: ["GET", "POST"] },
  });

  function ensureRoom(mapId, map, db) {
    let room = rooms.get(mapId);
    if (!room) {
      const matchId = uid("match");
      db.matches[matchId] = {
        match_id: matchId, map_id: mapId, creator: map.creator, mode: "pvp",
        started_at: Date.now(), ended_at: null, players: [], movement: {}, events: 0, kills: 0, valid: true,
      };
      room = { matchId, players: new Map() };
      rooms.set(mapId, room);
    }
    return room;
  }

  io.on("connection", (socket) => {
    const ip = (socket.handshake.headers["x-forwarded-for"] || socket.handshake.address || "").toString().split(",")[0].trim();

    socket.on("join", (data = {}) => {
      const db = read();
      const map = db.maps[data.map_id];
      if (!map || !map.published) return socket.emit("join_error", { error: "map not found or unpublished" });
      const room = ensureRoom(data.map_id, map, db);
      if (room.players.size >= MAX_PLAYERS) return socket.emit("join_error", { error: "match full" });

      const sp = spawnsOf(map);
      const spawn = sp[room.players.size % sp.length];
      const wallet = (data.wallet || "").trim();
      const player = {
        id: socket.id, wallet, username: (data.username || "player").slice(0, 32),
        loadout: data.loadout || { primary: "m4", secondary: "glock", armor: "none" },
        map_id: data.map_id, ip, hp: 100, alive: true, moving: false, aiming: false,
        x: spawn.x, y: spawn.y, z: spawn.z, yaw: spawn.yaw, pitch: 0,
        joinedAt: Date.now(), lastX: spawn.x, lastZ: spawn.z,
      };
      room.players.set(socket.id, player);
      socket.data = { mapId: data.map_id, wallet };
      socket.join(data.map_id);

      const match = db.matches[room.matchId];
      if (match && wallet && !match.players.includes(wallet)) match.players.push(wallet);
      map.stats.plays = (map.stats.plays || 0) + 1;
      write(db);

      socket.emit("snapshot", {
        map_id: data.map_id, self: { id: socket.id, spawn },
        players: [...room.players.values()].filter((p) => p.id !== socket.id).map(publicPlayer),
        max: MAX_PLAYERS,
      });
      socket.to(data.map_id).emit("player_join", publicPlayer(player));
      io.to(data.map_id).emit("counts", { map_id: data.map_id, active: room.players.size, max: MAX_PLAYERS });
    });

    socket.on("move", (m = {}) => {
      const room = rooms.get(socket.data?.mapId);
      const p = room?.players.get(socket.id);
      if (!p) return;
      Object.assign(p, { x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: m.pitch, moving: !!m.moving, aiming: !!m.aiming });
      // accumulate movement for anti-farm
      const db = read();
      const match = db.matches[room.matchId];
      if (match && p.wallet) {
        const d = Math.hypot((m.x || 0) - p.lastX, (m.z || 0) - p.lastZ);
        if (d > 0) match.movement[p.wallet] = (match.movement[p.wallet] || 0) + d;
        p.lastX = m.x; p.lastZ = m.z;
      }
      socket.to(socket.data.mapId).emit("player_move", { id: socket.id, x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: m.pitch, moving: !!m.moving, aiming: !!m.aiming });
    });

    socket.on("shoot", (s = {}) => {
      if (!socket.data?.mapId) return;
      socket.to(socket.data.mapId).emit("player_shoot", { id: socket.id, weapon: s.weapon, origin: s.origin, dir: s.dir });
    });
    socket.on("reload", (s = {}) => {
      if (!socket.data?.mapId) return;
      socket.to(socket.data.mapId).emit("player_reload", { id: socket.id, weapon: s.weapon });
    });

    socket.on("hit", (h = {}) => {
      const room = rooms.get(socket.data?.mapId);
      if (!room) return;
      const shooter = room.players.get(socket.id);
      const target = room.players.get(h.targetId);
      if (!shooter || !shooter.alive || !target || !target.alive) return;
      const dmg = h.head ? 1000 : DMG[h.weapon] || 25;
      target.hp = Math.max(0, target.hp - dmg);
      io.to(socket.data.mapId).emit("health", { id: target.id, hp: target.hp });

      if (target.hp <= 0) {
        target.alive = false;
        const db = read();
        const map = db.maps[socket.data.mapId];
        const match = db.matches[room.matchId];
        const killerP = db.players[shooter.wallet] || null;
        const victimP = db.players[target.wallet] || null;
        const result = recordValidatedKill(db, {
          map, match, killer: killerP, victim: victimP, weapon: h.weapon, head: !!h.head,
          killerIp: shooter.ip, victimIp: target.ip,
          fire_rate: 8, accuracy: 0.4, killer_distance: match?.movement?.[shooter.wallet] || 0,
          time_since_spawn_ms: Date.now() - (target.joinedAt || 0),
        });
        if (match) match.kills += 1;
        write(db);
        io.to(socket.data.mapId).emit("killed", {
          killer: { id: shooter.id, name: shooter.username }, victim: { id: target.id, name: target.username },
          head: !!h.head, weapon: h.weapon, counted: result.counted, reason: result.reasons[0] || null,
        });
      }
    });

    socket.on("respawn", (r = {}) => {
      const room = rooms.get(socket.data?.mapId);
      const p = room?.players.get(socket.id);
      if (!p) return;
      p.alive = true; p.hp = 100;
      if (typeof r.x === "number") { p.x = r.x; p.y = r.y; p.z = r.z; p.yaw = r.yaw; p.lastX = r.x; p.lastZ = r.z; }
      io.to(socket.data.mapId).emit("player_respawn", { id: socket.id, x: p.x, y: p.y, z: p.z, hp: 100 });
    });

    socket.on("disconnect", () => {
      const mapId = socket.data?.mapId;
      const room = rooms.get(mapId);
      if (!room) return;
      room.players.delete(socket.id);
      socket.to(mapId).emit("player_leave", { id: socket.id });
      io.to(mapId).emit("counts", { map_id: mapId, active: room.players.size, max: MAX_PLAYERS });
      if (room.players.size === 0) {
        const db = read();
        const match = db.matches[room.matchId];
        if (match) match.ended_at = Date.now();
        write(db);
        rooms.delete(mapId);
      }
    });
  });

  console.log(`[realtime] socket.io ready (max ${MAX_PLAYERS} players/room)`);
  return io;
}
