import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import type { GameMap, Vec3 } from "../lib/types";
import { AssetMesh } from "./AssetMesh";
import { WeaponModel } from "./WeaponModel";
import { Fighter, makeFighterState, enemyPalette, PALETTES, type FighterState } from "./Fighter";
import { DamageNumbers, type DamageHandle } from "./DamageNumbers";
import { useGame } from "../lib/gameStore";
import { usePlayer } from "../lib/player";
import { useLoadout, armorPoints } from "../lib/loadout";
import { sound, unlockAudio } from "../lib/sound";
import * as net from "../lib/net";
import {
  buildSolids, sampleGround, resolveHorizontal, mapBounds, rayAABB, raySphere,
  spawnsWithFacing, resolveRules, PLAYER, WEAPONS, type Solid, type WeaponId, type SpawnPoint,
} from "../lib/fps";

// Forest battlefield lighting: warm golden ambient, dappled daylight, green haze.
const LIGHT: Record<string, { sky: string; ground: string; sun: number; amb: number; fog: string; far: number; sunColor: string }> = {
  forest: { sky: "#b8d4b0", ground: "#2E4425", sun: 1.4, amb: 0.8, fog: "#5a7050", far: 140, sunColor: "#ffe3a8" },
  dusk: { sky: "#c99b6a", ground: "#22301C", sun: 1.0, amb: 0.5, fog: "#5c503a", far: 110, sunColor: "#ffc890" },
  night: { sky: "#20301F", ground: "#0A1F0A", sun: 0.4, amb: 0.35, fog: "#101B10", far: 70, sunColor: "#a8c0a0" },
  indoor: { sky: "#a8a890", ground: "#1E160E", sun: 0.8, amb: 0.7, fog: "#171208", far: 90, sunColor: "#ffe3a8" },
  warehouse: { sky: "#a8a890", ground: "#1E160E", sun: 1.0, amb: 0.6, fog: "#1E160E", far: 110, sunColor: "#ffe0a0" },
};
LIGHT.desert = LIGHT.forest; // legacy preset id from older maps

interface Bot {
  id: string; name: string; weapon: WeaponId; pos: THREE.Vector3; hp: number; alive: boolean;
  respawnAt: number; target: THREE.Vector3; nextShot: number; state: FighterState; yaw: number;
}
interface Cbs {
  onKill: (info: { weapon: string; ctx: Record<string, number> }) => void;
  onMove: (distance: number) => void;
}
const TRACERS = 22;
const SPARKS = 14;
const WFLASH = 10; // world muzzle flashes for NPCs / remote players
const isPickup = (k: string) => k.startsWith("pickup");

function RemoteOne({ id }: { id: string }) {
  const g = useRef<THREE.Group>(null);
  const stateRef = useRef<FighterState>(makeFighterState(Math.random() * 6));
  const p0 = net.getRemote().get(id);
  const weapon = (p0?.loadout?.primary as WeaponId) || "ak";
  const palette = useMemo(() => [PALETTES.mercenary, PALETTES.raider, PALETTES.militia, PALETTES.desert][Math.floor(Math.random() * 4)], []);
  useFrame(() => {
    const p = net.getRemote().get(id);
    if (!p || !g.current) return;
    g.current.visible = true;
    g.current.position.set(p.x, p.y - (p.crouch ? 0.35 : 0), p.z);
    g.current.rotation.y = p.yaw + Math.PI;
    stateRef.current.moving = p.moving;
    stateRef.current.aiming = p.aiming;
    if (p.alive && stateRef.current.dead) stateRef.current.dead = false;
    if (!p.alive && !stateRef.current.dead) { stateRef.current.dead = true; stateRef.current.deadAt = performance.now(); }
  });
  return (
    <group ref={g}>
      <Fighter palette={palette} weapon={weapon} stateRef={stateRef} />
    </group>
  );
}

function RemotePlayers() {
  const ids = useNetIds();
  return <>{ids.map((id) => <RemoteOne key={id} id={id} />)}</>;
}
function useNetIds() {
  return net.useNet((s) => s.ids);
}

function Arena({ map, cbs }: { map: GameMap; cbs: Cbs }) {
  const { camera } = useThree();
  const solids = useMemo<Solid[]>(() => buildSolids(map), [map]);
  const spawns = useMemo<SpawnPoint[]>(() => spawnsWithFacing(map), [map]);
  const bounds = useMemo(() => mapBounds(map), [map]);
  const rules = useMemo(() => resolveRules(map), [map]);
  const preset = LIGHT[map.lighting?.preset || "forest"] || LIGHT.forest;
  const lights = useMemo(() => map.objects.filter((o) => o.kind === "light"), [map]);
  const worldObjects = useMemo(() => map.objects.filter((o) => o.kind !== "light" && !isPickup(o.kind)), [map]);
  const pickupObjs = useMemo(() => map.objects.filter((o) => isPickup(o.kind)), [map]);
  const npcCount = Math.max(0, Math.min(10, map.rules?.npc_count ?? 3));

  const { wallet, username } = usePlayer();
  const loadout = useLoadout((s) => s.loadout);
  const weapon = useGame((s) => s.weapon);

  const botGroups = useRef<(THREE.Group | null)[]>([]);
  const vmRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Group>(null);
  const tracerRefs = useRef<(THREE.Mesh | null)[]>([]);
  const sparkRefs = useRef<(THREE.Mesh | null)[]>([]);
  const dmgRef = useRef<DamageHandle>(null);
  const recoil = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const firing = useRef(false);
  const wantShot = useRef(false);
  const moveAccum = useRef(0);
  const moveSentAt = useRef(0);
  const netSentAt = useRef(0);
  const flashUntil = useRef(0);
  const tracerPool = useRef(Array.from({ length: TRACERS }, () => ({ until: 0 })));
  const sparkPool = useRef(Array.from({ length: SPARKS }, () => ({ until: 0 })));
  const wflashRefs = useRef<(THREE.Mesh | null)[]>([]);
  const wflashPool = useRef(Array.from({ length: WFLASH }, () => ({ until: 0 })));
  const stepAt = useRef(0);
  const eyeCur = useRef(PLAYER.eye);
  const crouchToggle = useRef(false);
  const pickupRefs = useRef<(THREE.Group | null)[]>([]);
  const pickupTaken = useRef<number[]>(pickupObjs.map(() => 0));

  // resolve the player's two weapons from their loadout, gated by the map's allowed set
  const allowed = rules.allowed_weapons;
  const primary = allowed.includes(loadout.primary) ? loadout.primary : rules.starting_weapon;
  const secondary = allowed.includes(loadout.secondary) ? loadout.secondary : (allowed.find((w) => WEAPONS[w].category === "pistol") || allowed[0]);
  const myWeapons = [primary, secondary];

  const pickSpawn = (): SpawnPoint => spawns[Math.floor(Math.random() * spawns.length)];

  const bots = useRef<Bot[]>(
    Array.from({ length: npcCount }).map((_, i) => {
      const s = spawns[i % spawns.length].pos;
      return {
        id: "bot" + i, name: "NPC-" + String(i + 1).padStart(2, "0"), weapon: enemyPalette(i).weapon,
        pos: new THREE.Vector3(s[0], s[1], s[2]), hp: 100, alive: true, respawnAt: 0,
        target: new THREE.Vector3(s[0], s[1], s[2]), nextShot: 0, state: makeFighterState(i * 1.3), yaw: 0,
      };
    })
  );
  const botStateRefs = useMemo(() => bots.current.map((b) => ({ current: b.state })), []);

  const player = useRef({
    pos: new THREE.Vector3(0, 1, 0), velY: 0, onGround: false, wasGround: true, alive: true, respawnAt: 0,
    lastShot: 0, reloadUntil: 0, weapon: primary as WeaponId, slot: 0,
    ammo: WEAPONS[primary].mag, reserve: {} as Record<string, number>,
    health: rules.health, maxHealth: rules.health, armor: Math.max(rules.armor, armorPoints(loadout.armor)),
    spawnAt: performance.now(), shots: 0, hits: 0,
  });

  function applySpawn(sp: SpawnPoint) {
    player.current.pos.set(sp.pos[0], sp.pos[1] + 0.2, sp.pos[2]);
    player.current.velY = 0;
    player.current.health = player.current.maxHealth;
    player.current.armor = Math.max(rules.armor, armorPoints(loadout.armor));
    player.current.alive = true;
    player.current.spawnAt = performance.now();
    // upright, level horizon, facing the creator-set direction — never sky/floor.
    camera.rotation.order = "YXZ";
    camera.rotation.set(0, sp.yaw, 0);
    camera.position.set(sp.pos[0], sp.pos[1] + 0.2 + PLAYER.eye, sp.pos[2]);
    useGame.getState().set({ health: player.current.maxHealth });
  }

  // ---- multiplayer connection ----
  useEffect(() => {
    const sp = pickSpawn();
    applySpawn(sp);
    for (const id of [...allowed]) player.current.reserve[id] = Math.round(WEAPONS[id].reserve * rules.reserve_mult);
    useGame.getState().set({ weapon: player.current.weapon, ammo: player.current.ammo, mag: WEAPONS[player.current.weapon].mag, health: player.current.health, maxHealth: player.current.maxHealth });
    sound.startWind();

    net.connect(map.map_id, { wallet, username: username || "guest" }, loadout, {
      onShoot: (d) => {
        const wp = WEAPONS[d.weapon] || WEAPONS.m4;
        if (d.origin) {
          const from = new THREE.Vector3(d.origin[0], d.origin[1], d.origin[2]);
          sound.shot(wp.category, spatial(from));
          spawnWorldFlash(from);
          if (d.dir) spawnTracer(from, from.clone().add(new THREE.Vector3(d.dir[0], d.dir[1], d.dir[2]).multiplyScalar(wp.range)));
        } else sound.shot(wp.category, 0.5);
      },
      onReload: (d) => {
        const rp = net.getRemote().get(d.id);
        sound.reload(rp ? spatial(new THREE.Vector3(rp.x, rp.y + 1.2, rp.z)) : 0.5);
      },
      onHealth: (d) => {
        if (d.id === net.selfId()) {
          player.current.health = d.hp;
          useGame.getState().set({ health: Math.max(0, Math.round(d.hp)) });
        }
      },
      onKilled: (d) => {
        const g = useGame.getState();
        g.pushFeed({ killer: d.killer.name, victim: d.victim.name, weapon: d.weapon, head: d.head, self: d.victim.id === net.selfId() });
        sound.kill();
        if (d.head) sound.hit(true);
        if (d.killer.id === net.selfId() && d.victim.id !== net.selfId()) {
          g.set({ kills: g.kills + 1, score: g.score + (d.head ? 150 : 100) });
          // show whether this kill credited the creator reward, and if not, exactly why
          if (d.counted) g.set({ notice: `Reward kill — creator +${d.credited ?? 0.01} SOL`, noticeAt: performance.now(), lastKillInfo: "Verified kill counted" });
          else {
            const why = d.reason === "match too short" ? "match too new — rewards start after 60s" : d.reason || "rejected";
            g.set({ notice: `Kill not rewarded: ${why}`, noticeAt: performance.now(), lastKillInfo: `Not counted: ${why}` });
          }
        }
        if (d.victim.id === net.selfId()) {
          player.current.alive = false;
          player.current.respawnAt = performance.now() + 2200;
          g.set({ deaths: g.deaths + 1 });
        }
      },
      onRespawn: () => {},
    });

    return () => { net.disconnect(); sound.stopWind(); };
  }, []); // eslint-disable-line

  // ---- input ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "KeyR") reload();
      if (e.code === "Digit1") switchWeapon(0);
      if (e.code === "Digit2") switchWeapon(1);
      if (e.code === "KeyC") crouchToggle.current = !crouchToggle.current; // toggle crouch
    };
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    const md = (e: MouseEvent) => { if (e.button === 0) { firing.current = true; wantShot.current = true; unlockAudio(); } };
    const mu = (e: MouseEvent) => { if (e.button === 0) firing.current = false; };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    window.addEventListener("mousedown", md); window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("mousedown", md); window.removeEventListener("mouseup", mu);
    };
  }, []); // eslint-disable-line

  function switchWeapon(slot: number) {
    const w = myWeapons[slot];
    if (!w || player.current.reloadUntil) return;
    const p = player.current;
    p.slot = slot; p.weapon = w; p.ammo = WEAPONS[w].mag;
    useGame.getState().set({ weapon: w, ammo: p.ammo, mag: WEAPONS[w].mag, reloading: false });
    sound.reload();
  }
  function reload() {
    const p = player.current; const wp = WEAPONS[p.weapon];
    if (p.ammo >= wp.mag || p.reloadUntil || (p.reserve[p.weapon] || 0) <= 0) return;
    p.reloadUntil = performance.now() + wp.reload * 1000;
    useGame.getState().set({ reloading: true });
    sound.reload();
    net.sendReload({ weapon: p.weapon });
  }
  function respawnPlayer() {
    const sp = pickSpawn();
    applySpawn(sp);
    net.sendRespawn({ x: sp.pos[0], y: sp.pos[1] + 0.2, z: sp.pos[2], yaw: sp.yaw });
  }

  function muzzleWorld(): THREE.Vector3 {
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    return camera.position.clone().add(fwd.clone().multiplyScalar(0.7)).add(right.multiplyScalar(0.18)).add(new THREE.Vector3(0, -0.12, 0));
  }
  function spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const i = Math.max(0, tracerPool.current.findIndex((t) => t.until < performance.now()));
    const mesh = tracerRefs.current[i]; if (!mesh) return;
    mesh.position.copy(from.clone().add(to).multiplyScalar(0.5));
    mesh.lookAt(to); mesh.scale.set(1, 1, from.distanceTo(to)); mesh.visible = true;
    tracerPool.current[i].until = performance.now() + 70;
  }
  function spawnSpark(at: THREE.Vector3) {
    const i = Math.max(0, sparkPool.current.findIndex((t) => t.until < performance.now()));
    const mesh = sparkRefs.current[i]; if (!mesh) return;
    mesh.position.copy(at); mesh.scale.setScalar(1); mesh.visible = true;
    sparkPool.current[i].until = performance.now() + 140; sound.impact();
  }
  function spawnWorldFlash(at: THREE.Vector3) {
    const i = Math.max(0, wflashPool.current.findIndex((t) => t.until < performance.now()));
    const mesh = wflashRefs.current[i]; if (!mesh) return;
    mesh.position.copy(at); mesh.visible = true;
    wflashPool.current[i].until = performance.now() + 60;
  }
  // distance-based volume so far-away shots are quieter (cheap spatialisation)
  function spatial(at: THREE.Vector3): number {
    return Math.max(0.06, Math.min(1, 1 - camera.position.distanceTo(at) / 42));
  }

  function fire(now: number) {
    const p = player.current; const wp = WEAPONS[p.weapon];
    if (p.reloadUntil) return;
    if (p.ammo <= 0) { sound.empty(); reload(); return; }
    if (now - p.lastShot < 1000 / wp.fireRate) return;
    p.lastShot = now; p.ammo -= 1; p.shots += 1;
    recoil.current = Math.min(0.14, recoil.current + (wp.category === "sniper" ? 0.14 : 0.06));
    flashUntil.current = now + 45;
    useGame.getState().set({ ammo: p.ammo });
    sound.shot(wp.category);

    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const origin = camera.position.clone();
    const muzzle = muzzleWorld();
    const ro: Vec3 = [origin.x, origin.y, origin.z];
    net.sendShoot({ weapon: p.weapon, origin: [muzzle.x, muzzle.y, muzzle.z], dir: [dir.x, dir.y, dir.z] });

    const pellets = wp.pellets || 1;
    let anyHit = false, anyHead = false;
    for (let s = 0; s < pellets; s++) {
      const rd = dir.clone();
      rd.x += (Math.random() - 0.5) * wp.spread * 2; rd.y += (Math.random() - 0.5) * wp.spread * 2; rd.z += (Math.random() - 0.5) * wp.spread * 2;
      rd.normalize();
      const rda: Vec3 = [rd.x, rd.y, rd.z];
      let wallT: number = wp.range;
      for (const sol of solids) { const t = rayAABB(ro, rda, sol); if (t != null && t < wallT) wallT = t; }

      let bestT = Infinity, bestKind: "bot" | "remote" | null = null, bestBot: Bot | null = null, bestRemoteId: string | null = null, bestHead = false;
      for (const b of bots.current) {
        if (!b.alive) continue;
        const th = raySphere(ro, rda, [b.pos.x, b.pos.y + 1.7, b.pos.z], 0.26);
        const tb = raySphere(ro, rda, [b.pos.x, b.pos.y + 1.0, b.pos.z], 0.42);
        if (th != null && th < bestT && th < wallT) { bestT = th; bestBot = b; bestKind = "bot"; bestHead = true; }
        if (tb != null && tb < bestT && tb < wallT) { bestT = tb; bestBot = b; bestKind = "bot"; bestHead = false; }
      }
      for (const [id, rp] of net.getRemote()) {
        if (!rp.alive) continue;
        const th = raySphere(ro, rda, [rp.x, rp.y + 1.7, rp.z], 0.26);
        const tb = raySphere(ro, rda, [rp.x, rp.y + 1.0, rp.z], 0.42);
        if (th != null && th < bestT && th < wallT) { bestT = th; bestRemoteId = id; bestKind = "remote"; bestHead = true; }
        if (tb != null && tb < bestT && tb < wallT) { bestT = tb; bestRemoteId = id; bestKind = "remote"; bestHead = false; }
      }

      const endDist = bestKind ? bestT : wallT;
      const end = origin.clone().add(rd.clone().multiplyScalar(endDist));
      if (s === 0 || pellets <= 3) spawnTracer(muzzle, end);

      if (bestKind === "bot" && bestBot) {
        const dmg = bestHead ? 1000 : wp.damage;
        bestBot.hp -= dmg; anyHit = true; if (bestHead) anyHead = true;
        dmgRef.current?.add([bestBot.pos.x, bestBot.pos.y + (bestHead ? 1.75 : 1.1), bestBot.pos.z], bestHead ? 100 : wp.damage, bestHead);
        if (bestBot.hp <= 0) killBot(bestBot, now, bestHead);
      } else if (bestKind === "remote" && bestRemoteId) {
        // server-authoritative: report the hit, show local feedback only
        net.sendHit({ targetId: bestRemoteId, weapon: p.weapon, head: bestHead });
        anyHit = true; if (bestHead) anyHead = true;
        const rp = net.getRemote().get(bestRemoteId)!;
        dmgRef.current?.add([rp.x, rp.y + (bestHead ? 1.75 : 1.1), rp.z], bestHead ? 100 : wp.damage, bestHead);
      } else if (wallT < wp.range) {
        spawnSpark(end);
      }
    }
    if (anyHit) { p.hits += 1; sound.hit(anyHead); useGame.getState().set({ hitMarker: now, headMarker: anyHead ? now : useGame.getState().headMarker }); }
  }

  function killBot(b: Bot, now: number, head: boolean) {
    b.alive = false; b.state.dead = true; b.state.deadAt = now; b.respawnAt = now + 4200;
    const p = player.current; const acc = p.shots ? p.hits / p.shots : 0;
    cbs.onKill({ weapon: p.weapon, ctx: { time_since_spawn_ms: now - p.spawnAt, fire_rate: WEAPONS[p.weapon].fireRate, accuracy: +acc.toFixed(3), killer_distance: Math.round(moveAccum.current) } });
    const g = useGame.getState();
    g.set({ kills: g.kills + 1, score: g.score + (head ? 150 : 100) });
    g.pushFeed({ killer: "You", victim: b.name, weapon: p.weapon, head });
    sound.kill();
  }
  function damagePlayer(dmg: number, now: number) {
    const p = player.current; if (!p.alive) return;
    const absorbed = p.armor > 0 ? dmg * 0.5 : 0; p.armor = Math.max(0, p.armor - absorbed);
    p.health -= dmg - absorbed;
    useGame.getState().set({ health: Math.max(0, Math.round(p.health)) });
    if (p.health <= 0) { p.alive = false; p.respawnAt = now + 2200; useGame.getState().set({ deaths: useGame.getState().deaths + 1 }); }
  }
  function takePickup(o: any, i: number, now: number) {
    const p = player.current;
    pickupTaken.current[i] = now + 8000; // local cooldown (server is authoritative for others)
    net.sendPickup(o.id);
    sound.pickup();
    const g = useGame.getState();
    if (o.kind === "pickup_health") {
      if (p.health >= p.maxHealth) { pickupTaken.current[i] = 0; return; } // don't waste it at full HP
      p.health = Math.min(p.maxHealth, p.health + 40);
      g.set({ health: Math.round(p.health), notice: "+40 Health", noticeAt: now });
    } else if (o.kind === "pickup_ammo") {
      p.reserve[p.weapon] = Math.round(WEAPONS[p.weapon].reserve * rules.reserve_mult);
      g.set({ notice: "Ammo refilled", noticeAt: now });
    } else if (o.kind === "pickup_weapon") {
      const wid = (o.settings?.weapon as string) || "";
      const w = WEAPONS[wid] ? wid : "m4";
      p.weapon = w; p.ammo = WEAPONS[w].mag;
      if (!p.reserve[w]) p.reserve[w] = Math.round(WEAPONS[w].reserve * rules.reserve_mult);
      g.set({ weapon: w, ammo: p.ammo, mag: WEAPONS[w].mag, notice: "Picked up " + WEAPONS[w].name, noticeAt: now });
    }
  }

  useFrame((_s, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const now = performance.now();
    const playing = useGame.getState().status === "playing";
    const p = player.current;

    if (p.reloadUntil && now >= p.reloadUntil) {
      const wp = WEAPONS[p.weapon]; const need = wp.mag - p.ammo; const take = Math.min(need, p.reserve[p.weapon] || 0);
      p.ammo += take; p.reserve[p.weapon] = (p.reserve[p.weapon] || 0) - take; p.reloadUntil = 0;
      useGame.getState().set({ ammo: p.ammo, reloading: false });
    }
    if (!p.alive && now >= p.respawnAt) respawnPlayer();

    if (playing && p.alive) {
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      const fwd = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      const wish = new THREE.Vector3();
      if (keys.current["KeyW"]) wish.add(fwd); if (keys.current["KeyS"]) wish.sub(fwd);
      if (keys.current["KeyD"]) wish.add(right); if (keys.current["KeyA"]) wish.sub(right);
      const crouch = !!keys.current["ControlLeft"] || crouchToggle.current; // Ctrl hold or C toggle
      const sprint = !!keys.current["ShiftLeft"] && !crouch;
      const speed = crouch ? PLAYER.crouch : sprint ? PLAYER.sprint : PLAYER.walk;
      if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
      const height = crouch ? PLAYER.crouchHeight : PLAYER.height;

      const before = p.pos.clone();
      p.pos.x += wish.x * dt; p.pos.z += wish.z * dt;
      const res = resolveHorizontal(solids, [p.pos.x, p.pos.y, p.pos.z], p.pos.y, p.pos.y + height);
      p.pos.x = Math.max(bounds.min[0], Math.min(bounds.max[0], res[0]));
      p.pos.z = Math.max(bounds.min[2], Math.min(bounds.max[2], res[2]));
      if (keys.current["Space"] && p.onGround) { p.velY = PLAYER.jump; p.onGround = false; sound.jump(); }
      p.velY += PLAYER.gravity * dt;
      p.pos.y += p.velY * dt;
      // Support surface at/below the feet (ignores overhead platforms). Stick to it
      // within step height so the player follows ramps/stairs smoothly up AND down.
      const ground = sampleGround(solids, p.pos.x, p.pos.z, p.pos.y, PLAYER.step);
      if (ground > -Infinity && p.velY <= 0 && p.pos.y <= ground + PLAYER.step) {
        if (!p.wasGround && p.velY < -6) sound.land();
        p.pos.y = ground; p.velY = 0; p.onGround = true;
      } else {
        p.onGround = false;
      }
      p.wasGround = p.onGround;
      if (p.pos.y < -25) respawnPlayer();

      const moved = Math.hypot(p.pos.x - before.x, p.pos.z - before.z);
      moveAccum.current += moved;
      if (p.onGround && moved > 0.02 && now - stepAt.current > (sprint ? 320 : 440)) { sound.footstep(); stepAt.current = now; }
      if (now - moveSentAt.current > 3000 && moveAccum.current > 0) { cbs.onMove(moveAccum.current); moveAccum.current = 0; moveSentAt.current = now; }

      // smooth crouch camera transition
      const eyeTarget = crouch ? PLAYER.crouchEye : PLAYER.eye;
      eyeCur.current += (eyeTarget - eyeCur.current) * Math.min(1, dt * 12);
      camera.position.set(p.pos.x, p.pos.y + eyeCur.current, p.pos.z);

      const wp = WEAPONS[p.weapon];
      if ((firing.current && wp.auto) || wantShot.current) fire(now);
      wantShot.current = false;

      // pickups
      for (let i = 0; i < pickupObjs.length; i++) {
        const o = pickupObjs[i];
        const ref = pickupRefs.current[i];
        const remoteTaken = (net.getPickups().get(o.id) || 0) > now;
        const taken = now < pickupTaken.current[i] || remoteTaken;
        if (ref) { ref.visible = !taken; if (!taken) ref.rotation.y += dt * 1.5; }
        if (taken) continue;
        const dx = p.pos.x - o.position[0], dz = p.pos.z - o.position[2], dy = p.pos.y - o.position[1];
        if (Math.hypot(dx, dz) < 1.6 && Math.abs(dy) < 2) takePickup(o, i, now);
      }

      // network sync (~12 Hz)
      if (now - netSentAt.current > 80) {
        net.sendMove({ x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: camera.rotation.y, pitch: camera.rotation.x, moving: wish.lengthSq() > 0, aiming: firing.current, crouch });
        netSentAt.current = now;
      }
    }

    recoil.current *= 0.82;
    if (vmRef.current) {
      vmRef.current.position.copy(camera.position); vmRef.current.quaternion.copy(camera.quaternion);
      vmRef.current.translateX(0.22); vmRef.current.translateY(-0.22); vmRef.current.translateZ(-0.5 + recoil.current);
    }
    if (flashRef.current) flashRef.current.visible = now < flashUntil.current;

    for (let i = 0; i < TRACERS; i++) { const m = tracerRefs.current[i]; if (m && m.visible && performance.now() >= tracerPool.current[i].until) m.visible = false; }
    for (let i = 0; i < SPARKS; i++) {
      const m = sparkRefs.current[i];
      if (m && m.visible) { const left = sparkPool.current[i].until - performance.now(); if (left <= 0) m.visible = false; else m.scale.setScalar(Math.max(0.1, left / 140)); }
    }
    for (let i = 0; i < WFLASH; i++) { const m = wflashRefs.current[i]; if (m && m.visible && now >= wflashPool.current[i].until) m.visible = false; }

    // bots (local test targets)
    bots.current.forEach((b, i) => {
      const g = botGroups.current[i];
      if (!b.alive) {
        if (now >= b.respawnAt) { const s = pickSpawn().pos; b.pos.set(s[0], s[1], s[2]); b.hp = 100; b.alive = true; b.state.dead = false; }
        if (g) g.position.copy(b.pos);
        return;
      }
      const toP = new THREE.Vector3(p.pos.x - b.pos.x, 0, p.pos.z - b.pos.z);
      const distP = toP.length();
      const engaged = playing && p.alive && distP < 30;
      let mv: THREE.Vector3;
      if (engaged && distP > 8) mv = toP.clone().normalize();
      else if (engaged) mv = new THREE.Vector3(-toP.z, 0, toP.x).normalize().multiplyScalar(Math.sin(now / 700 + i) > 0 ? 1 : -1);
      else { if (b.pos.distanceTo(b.target) < 1.5) b.target.set(bounds.min[0] + Math.random() * (bounds.max[0] - bounds.min[0]), 0, bounds.min[2] + Math.random() * (bounds.max[2] - bounds.min[2])); mv = new THREE.Vector3(b.target.x - b.pos.x, 0, b.target.z - b.pos.z).normalize(); }
      const bspeed = engaged ? 3.6 : 2.6;
      const r = resolveHorizontal(solids, [b.pos.x + mv.x * bspeed * dt, b.pos.y, b.pos.z + mv.z * bspeed * dt], b.pos.y, b.pos.y + 1.7);
      b.pos.x = Math.max(bounds.min[0], Math.min(bounds.max[0], r[0])); b.pos.z = Math.max(bounds.min[2], Math.min(bounds.max[2], r[2]));
      const bg = sampleGround(solids, b.pos.x, b.pos.z, b.pos.y + 0.6, 1.0); b.pos.y = bg > -Infinity ? bg : b.pos.y;
      b.state.moving = (Math.abs(mv.x) + Math.abs(mv.z)) > 0.1; b.state.aiming = engaged;
      b.yaw = engaged ? Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z) : Math.atan2(mv.x, mv.z);
      if (g) { g.position.copy(b.pos); g.rotation.y = b.yaw; }
      if (engaged && now >= b.nextShot) {
        b.nextShot = now + 700 + Math.random() * 900;
        const muzzle = new THREE.Vector3(b.pos.x, b.pos.y + 1.4, b.pos.z);
        const rd = new THREE.Vector3(p.pos.x - b.pos.x, (p.pos.y + 1.2) - (b.pos.y + 1.4), p.pos.z - b.pos.z).normalize();
        const ro: Vec3 = [muzzle.x, muzzle.y, muzzle.z]; const rda: Vec3 = [rd.x, rd.y, rd.z];
        let blocked = false; for (const sol of solids) { const t = rayAABB(ro, rda, sol); if (t != null && t < distP - 0.5) { blocked = true; break; } }
        if (!blocked) {
          const wp = WEAPONS[b.weapon];
          sound.shot(wp.category, spatial(muzzle)); // audible (quieter with distance)
          spawnWorldFlash(muzzle); // visible muzzle flash
          spawnTracer(muzzle, muzzle.clone().add(rd.clone().multiplyScalar(Math.min(distP, wp.range)))); // visible tracer
          if (Math.random() < 0.5) damagePlayer(7 + Math.random() * 6, now);
        }
      }
    });
  });

  return (
    <>
      <color attach="background" args={[preset.ground]} />
      <fog attach="fog" args={[preset.fog, 18, preset.far]} />
      <hemisphereLight args={[preset.sky, preset.ground, preset.amb]} />
      <directionalLight position={[40, 60, 25]} intensity={preset.sun} color={preset.sunColor} castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-80, 80, 80, -80, 0.1, 250]} />
      </directionalLight>
      {lights.map((o) => (
        <pointLight key={o.id} position={[o.position[0], o.position[1] + 0.5, o.position[2]]} intensity={(o.settings?.intensity || 1) * 8} distance={18} color={o.color || "#ffd98a"} />
      ))}

      {worldObjects.map((o) => <AssetMesh key={o.id} object={o} />)}

      {/* pickups (functional: walk over to collect; hide when taken, respawn after cooldown) */}
      {pickupObjs.map((o, i) => (
        <group key={o.id} ref={(el) => (pickupRefs.current[i] = el)}>
          <AssetMesh object={o} />
        </group>
      ))}

      {bots.current.map((b, i) => (
        <group key={b.id} ref={(el) => (botGroups.current[i] = el)}>
          <Fighter palette={enemyPalette(i).palette} weapon={b.weapon} stateRef={botStateRefs[i]} />
        </group>
      ))}

      <RemotePlayers />

      <group ref={vmRef}>
        <WeaponModel weaponId={weapon} />
        <group ref={flashRef} position={[0, 0.02, -0.78]} visible={false}>
          <mesh scale={[1, 1, 1.6]}><icosahedronGeometry args={[0.11, 0]} /><meshBasicMaterial color="#ffd27a" transparent opacity={0.92} /></mesh>
          <pointLight color="#ffcf8a" intensity={6} distance={6} />
        </group>
      </group>

      {Array.from({ length: TRACERS }).map((_, i) => (
        <mesh key={"t" + i} ref={(el) => (tracerRefs.current[i] = el)} visible={false}>
          <boxGeometry args={[0.02, 0.02, 1]} /><meshBasicMaterial color="#ffe08a" transparent opacity={0.9} />
        </mesh>
      ))}
      {Array.from({ length: SPARKS }).map((_, i) => (
        <mesh key={"s" + i} ref={(el) => (sparkRefs.current[i] = el)} visible={false}>
          <icosahedronGeometry args={[0.12, 0]} /><meshBasicMaterial color="#ffd08a" />
        </mesh>
      ))}
      {/* world muzzle flashes for NPCs / remote players */}
      {Array.from({ length: WFLASH }).map((_, i) => (
        <mesh key={"wf" + i} ref={(el) => (wflashRefs.current[i] = el)} visible={false}>
          <icosahedronGeometry args={[0.17, 0]} /><meshBasicMaterial color="#ffd27a" transparent opacity={0.95} />
        </mesh>
      ))}

      <DamageNumbers ref={dmgRef} />

      <PointerLockControls
        onLock={() => { unlockAudio(); useGame.getState().set({ status: "playing" }); }}
        onUnlock={() => { if (useGame.getState().status === "playing") useGame.getState().set({ status: "ready" }); }}
      />
    </>
  );
}

export function FPSScene({ map, cbs }: { map: GameMap; test?: boolean; cbs: Cbs }) {
  return (
    <Canvas shadows camera={{ fov: 80, near: 0.05, far: 320, position: [0, 2, 0] }} dpr={[1, 2]}>
      <Arena map={map} cbs={cbs} />
    </Canvas>
  );
}
