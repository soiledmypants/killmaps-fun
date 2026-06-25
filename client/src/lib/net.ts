// Socket.io client: connects to a match room, relays local player state, and tracks
// remote players. High-frequency transforms live in a plain mutable Map (read in the
// render loop); only roster/counts changes hit React via the zustand store.
import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import type { Loadout } from "./types";

const SOCKET_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  (import.meta.env.DEV ? "http://localhost:9001" : typeof window !== "undefined" ? window.location.origin : "");

export interface RemotePlayer {
  id: string;
  wallet: string;
  username: string;
  loadout: Loadout;
  x: number; y: number; z: number; yaw: number; pitch: number;
  hp: number; alive: boolean; moving: boolean; aiming: boolean; crouch: boolean;
}

const remote = new Map<string, RemotePlayer>();
// objId -> timestamp(ms) until which the pickup is taken (server-authoritative)
const pickups = new Map<string, number>();
export function getRemote() {
  return remote;
}
export function getPickups() {
  return pickups;
}

export interface NetHandlers {
  onShoot?: (d: { id: string; weapon: string; origin: number[]; dir: number[] }) => void;
  onReload?: (d: { id: string; weapon: string }) => void;
  onKilled?: (d: { killer: { id: string; name: string }; victim: { id: string; name: string }; head: boolean; weapon: string; counted: boolean; credited?: number; reason: string | null; reasons?: string[] }) => void;
  onHealth?: (d: { id: string; hp: number }) => void;
  onRespawn?: (d: { id: string; x: number; y: number; z: number }) => void;
}

interface NetState {
  connected: boolean;
  selfId: string | null;
  ids: string[];
  counts: Record<string, number>;
  maxPlayers: number;
}
export const useNet = create<NetState>(() => ({ connected: false, selfId: null, ids: [], counts: {}, maxPlayers: 16 }));

let socket: Socket | null = null;
let handlers: NetHandlers = {};

function syncRoster() {
  useNet.setState({ ids: [...remote.keys()] });
}

export function connect(mapId: string, identity: { wallet: string; username: string }, loadout: Loadout, h: NetHandlers) {
  handlers = h;
  remote.clear();
  socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    useNet.setState({ connected: true, selfId: socket!.id });
    socket!.emit("join", { map_id: mapId, wallet: identity.wallet, username: identity.username, loadout });
  });
  socket.on("disconnect", () => useNet.setState({ connected: false }));
  socket.on("join_error", (e) => console.warn("[net] join error:", e?.error));

  socket.on("snapshot", (d: { players: RemotePlayer[]; max: number; pickups?: Record<string, number> }) => {
    remote.clear();
    for (const p of d.players) remote.set(p.id, p);
    pickups.clear();
    if (d.pickups) for (const [k, v] of Object.entries(d.pickups)) pickups.set(k, v);
    useNet.setState({ maxPlayers: d.max || 16 });
    syncRoster();
  });
  socket.on("pickup_taken", (d: { objId: string; until: number }) => pickups.set(d.objId, d.until));
  socket.on("player_join", (p: RemotePlayer) => { remote.set(p.id, p); syncRoster(); });
  socket.on("player_leave", ({ id }: { id: string }) => { remote.delete(id); syncRoster(); });
  socket.on("player_move", (m: any) => { const p = remote.get(m.id); if (p) Object.assign(p, m); });
  socket.on("player_shoot", (d: any) => handlers.onShoot?.(d));
  socket.on("player_reload", (d: any) => handlers.onReload?.(d));
  socket.on("health", (d: any) => { const p = remote.get(d.id); if (p) p.hp = d.hp; handlers.onHealth?.(d); });
  socket.on("killed", (d: any) => {
    const v = remote.get(d.victim.id); if (v) v.alive = false;
    handlers.onKilled?.(d);
  });
  socket.on("player_respawn", (d: any) => { const p = remote.get(d.id); if (p) { p.alive = true; p.hp = 100; p.x = d.x; p.y = d.y; p.z = d.z; } handlers.onRespawn?.(d); });
  socket.on("counts", (c: { map_id: string; active: number }) => useNet.setState((s) => ({ counts: { ...s.counts, [c.map_id]: c.active } })));
}

export const sendMove = (m: any) => { if (socket?.connected) socket.emit("move", m); };
export const sendShoot = (s: any) => socket?.emit("shoot", s);
export const sendReload = (s: any) => socket?.emit("reload", s);
export const sendHit = (h: any) => socket?.emit("hit", h);
export const sendRespawn = (r: any) => socket?.emit("respawn", r);
export const sendPickup = (objId: string) => socket?.emit("pickup", { objId });
export const selfId = () => socket?.id || null;
export function disconnect() {
  socket?.disconnect();
  socket = null;
  remote.clear();
  useNet.setState({ connected: false, selfId: null, ids: [] });
}
