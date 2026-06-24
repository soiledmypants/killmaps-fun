import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import type { GameMap, Vec3 } from "../lib/types";
import { AssetMesh } from "./AssetMesh";
import { WeaponModel } from "./WeaponModel";
import { Fighter, makeFighterState, enemyPalette, type FighterState } from "./Fighter";
import { DamageNumbers, type DamageHandle } from "./DamageNumbers";
import { useGame } from "../lib/gameStore";
import { sound, unlockAudio } from "../lib/sound";
import {
  buildSolids, sampleGround, resolveHorizontal, mapBounds, rayAABB, raySphere,
  spawnsOf, resolveRules, PLAYER, WEAPONS, type Solid, type WeaponId,
} from "../lib/fps";

const LIGHT: Record<string, { sky: string; ground: string; sun: number; amb: number; fog: string; far: number; sunColor: string }> = {
  desert: { sky: "#cfe0e8", ground: "#7a6238", sun: 1.5, amb: 0.85, fog: "#cdb78d", far: 150, sunColor: "#ffe9c2" },
  dusk: { sky: "#caa07a", ground: "#2a2018", sun: 1.0, amb: 0.5, fog: "#7a5a3a", far: 110, sunColor: "#ffcaa0" },
  night: { sky: "#2a3242", ground: "#0c0a06", sun: 0.4, amb: 0.35, fog: "#171410", far: 70, sunColor: "#9fb0c8" },
  indoor: { sky: "#b8b09c", ground: "#1a1610", sun: 0.8, amb: 0.7, fog: "#15120c", far: 90, sunColor: "#ffe9c2" },
  warehouse: { sky: "#b8b09c", ground: "#1a1610", sun: 1.0, amb: 0.6, fog: "#1a1610", far: 110, sunColor: "#ffe6bf" },
};

interface Bot {
  id: string;
  name: string;
  weapon: WeaponId;
  pos: THREE.Vector3;
  hp: number;
  alive: boolean;
  respawnAt: number;
  target: THREE.Vector3;
  nextShot: number;
  state: FighterState;
  yaw: number;
}

interface Cbs {
  onKill: (info: { weapon: string; ctx: Record<string, number> }) => void;
  onMove: (distance: number) => void;
}

const TRACERS = 18;
const SPARKS = 14;

function Arena({ map, cbs }: { map: GameMap; cbs: Cbs }) {
  const { camera } = useThree();
  const solids = useMemo<Solid[]>(() => buildSolids(map), [map]);
  const spawns = useMemo<Vec3[]>(() => spawnsOf(map), [map]);
  const bounds = useMemo(() => mapBounds(map), [map]);
  const rules = useMemo(() => resolveRules(map), [map]);
  const preset = LIGHT[map.lighting?.preset || "desert"] || LIGHT.desert;
  const lights = useMemo(() => map.objects.filter((o) => o.kind === "light"), [map]);

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
  const flashUntil = useRef(0);
  const tracerPool = useRef(Array.from({ length: TRACERS }, () => ({ until: 0 })));
  const sparkPool = useRef(Array.from({ length: SPARKS }, () => ({ until: 0, pos: new THREE.Vector3() })));
  const stepAt = useRef(0);

  const allowed = rules.allowed_weapons;
  const pickSpawn = () => spawns[Math.floor(Math.random() * spawns.length)];

  const bots = useRef<Bot[]>(
    Array.from({ length: 5 }).map((_, i) => {
      const s = spawns[i % spawns.length];
      const { weapon: w } = enemyPalette(i);
      return {
        id: "bot" + i, name: "Bot-" + String(i + 1).padStart(2, "0"), weapon: w,
        pos: new THREE.Vector3(s[0], s[1], s[2]), hp: 100, alive: true, respawnAt: 0,
        target: new THREE.Vector3(s[0], s[1], s[2]), nextShot: 0, state: makeFighterState(i * 1.3), yaw: 0,
      };
    })
  );
  const botStateRefs = useMemo(() => bots.current.map((b) => ({ current: b.state })), []);

  const player = useRef({
    pos: new THREE.Vector3(...pickSpawn()), velY: 0, onGround: false, wasGround: true, alive: true, respawnAt: 0,
    lastShot: 0, reloadUntil: 0, weapon: rules.starting_weapon as WeaponId,
    ammo: WEAPONS[rules.starting_weapon].mag, reserve: {} as Record<string, number>,
    health: rules.health, maxHealth: rules.health, armor: rules.armor,
    spawnAt: performance.now(), shots: 0, hits: 0,
  });

  // init reserves + HUD
  useEffect(() => {
    const p = player.current;
    for (const id of allowed) p.reserve[id] = Math.round(WEAPONS[id].reserve * rules.reserve_mult);
    useGame.getState().set({ weapon: p.weapon, ammo: p.ammo, mag: WEAPONS[p.weapon].mag, health: p.health, maxHealth: p.maxHealth });
    sound.startWind();
    return () => sound.stopWind();
  }, []); // eslint-disable-line

  // input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "KeyR") reload();
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= allowed.length) switchWeapon(allowed[n - 1]);
    };
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    const md = (e: MouseEvent) => { if (e.button === 0) { firing.current = true; wantShot.current = true; unlockAudio(); } };
    const mu = (e: MouseEvent) => { if (e.button === 0) firing.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousedown", md);
      window.removeEventListener("mouseup", mu);
    };
  }, []); // eslint-disable-line

  function switchWeapon(w: WeaponId) {
    if (!allowed.includes(w) || player.current.reloadUntil) return;
    const p = player.current;
    p.weapon = w;
    p.ammo = WEAPONS[w].mag;
    useGame.getState().set({ weapon: w, ammo: p.ammo, mag: WEAPONS[w].mag, reloading: false });
    sound.reload();
  }

  function reload() {
    const p = player.current;
    const wp = WEAPONS[p.weapon];
    if (p.ammo >= wp.mag || p.reloadUntil || (p.reserve[p.weapon] || 0) <= 0) return;
    p.reloadUntil = performance.now() + wp.reload * 1000;
    useGame.getState().set({ reloading: true });
    sound.reload();
  }

  function respawnPlayer() {
    const s = pickSpawn();
    player.current.pos.set(s[0], s[1] + 0.2, s[2]);
    player.current.velY = 0;
    player.current.health = player.current.maxHealth;
    player.current.alive = true;
    player.current.spawnAt = performance.now();
    useGame.getState().set({ health: player.current.maxHealth });
  }

  function muzzleWorld(): THREE.Vector3 {
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    return camera.position.clone().add(fwd.clone().multiplyScalar(0.7)).add(right.multiplyScalar(0.18)).add(new THREE.Vector3(0, -0.12, 0));
  }

  function spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const idx = tracerPool.current.findIndex((t) => t.until < performance.now());
    const i = idx === -1 ? 0 : idx;
    const mesh = tracerRefs.current[i];
    if (!mesh) return;
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const len = from.distanceTo(to);
    mesh.position.copy(mid);
    mesh.lookAt(to);
    mesh.scale.set(1, 1, len);
    mesh.visible = true;
    (mesh.material as THREE.Material).opacity = 0.9;
    tracerPool.current[i].until = performance.now() + 70;
  }

  function spawnSpark(at: THREE.Vector3) {
    const idx = sparkPool.current.findIndex((t) => t.until < performance.now());
    const i = idx === -1 ? 0 : idx;
    const mesh = sparkRefs.current[i];
    if (!mesh) return;
    mesh.position.copy(at);
    mesh.scale.setScalar(1);
    mesh.visible = true;
    sparkPool.current[i].until = performance.now() + 140;
    sound.impact();
  }

  function fire(now: number) {
    const p = player.current;
    const wp = WEAPONS[p.weapon];
    if (p.reloadUntil) return;
    if (p.ammo <= 0) { sound.empty(); reload(); return; }
    if (now - p.lastShot < 1000 / wp.fireRate) return;
    p.lastShot = now;
    p.ammo -= 1;
    p.shots += 1;
    recoil.current = Math.min(0.14, recoil.current + (wp.category === "sniper" ? 0.14 : 0.06));
    flashUntil.current = now + 45;
    useGame.getState().set({ ammo: p.ammo });
    sound.shot(wp.category);

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone();
    const muzzle = muzzleWorld();
    const ro: Vec3 = [origin.x, origin.y, origin.z];
    const pellets = wp.pellets || 1;
    let anyHit = false;
    let anyHead = false;

    for (let s = 0; s < pellets; s++) {
      const rd = dir.clone();
      rd.x += (Math.random() - 0.5) * wp.spread * 2;
      rd.y += (Math.random() - 0.5) * wp.spread * 2;
      rd.z += (Math.random() - 0.5) * wp.spread * 2;
      rd.normalize();
      const rda: Vec3 = [rd.x, rd.y, rd.z];

      let wallT = wp.range;
      let wallHit = true;
      for (const sol of solids) {
        const t = rayAABB(ro, rda, sol);
        if (t != null && t < wallT) { wallT = t; wallHit = true; }
      }

      let bestT = Infinity;
      let bestBot: Bot | null = null;
      let bestHead = false;
      for (const b of bots.current) {
        if (!b.alive) continue;
        const head: Vec3 = [b.pos.x, b.pos.y + 1.7, b.pos.z];
        const body: Vec3 = [b.pos.x, b.pos.y + 1.0, b.pos.z];
        const th = raySphere(ro, rda, head, 0.3);
        const tb = raySphere(ro, rda, body, 0.42);
        if (th != null && th < bestT && th < wallT) { bestT = th; bestBot = b; bestHead = true; }
        if (tb != null && tb < bestT && tb < wallT) { bestT = tb; bestBot = b; bestHead = false; }
      }

      // tracer endpoint
      const endDist = bestBot ? bestT : wallT;
      const end = origin.clone().add(rd.clone().multiplyScalar(endDist));
      if (s === 0 || pellets <= 3) spawnTracer(muzzle, end);

      if (bestBot) {
        const dmg = Math.round(wp.damage * (bestHead ? wp.headshotMult : 1));
        bestBot.hp -= dmg;
        anyHit = true;
        if (bestHead) anyHead = true;
        dmgRef.current?.add([bestBot.pos.x, bestBot.pos.y + (bestHead ? 1.75 : 1.1), bestBot.pos.z], dmg, bestHead);
        if (bestBot.hp <= 0) killBot(bestBot, now, bestHead);
      } else if (wallHit && wallT < wp.range) {
        spawnSpark(end);
      }
    }
    if (anyHit) {
      p.hits += 1;
      sound.hit(anyHead);
      useGame.getState().set({ hitMarker: now, headMarker: anyHead ? now : useGame.getState().headMarker });
    }
  }

  function killBot(b: Bot, now: number, head: boolean) {
    b.alive = false;
    b.state.dead = true;
    b.state.deadAt = now;
    b.respawnAt = now + 4200;
    const p = player.current;
    const acc = p.shots ? p.hits / p.shots : 0;
    cbs.onKill({ weapon: p.weapon, ctx: { time_since_spawn_ms: now - p.spawnAt, fire_rate: WEAPONS[p.weapon].fireRate, accuracy: +acc.toFixed(3), killer_distance: Math.round(moveAccum.current) } });
    const g = useGame.getState();
    g.set({ kills: g.kills + 1, score: g.score + (head ? 150 : 100) });
    g.pushFeed({ killer: "You", victim: b.name, weapon: p.weapon });
    sound.kill();
  }

  function damagePlayer(dmg: number, now: number) {
    const p = player.current;
    if (!p.alive) return;
    const absorbed = p.armor > 0 ? dmg * 0.5 : 0;
    p.armor = Math.max(0, p.armor - absorbed);
    p.health -= dmg - absorbed;
    useGame.getState().set({ health: Math.max(0, Math.round(p.health)) });
    if (p.health <= 0) {
      p.alive = false;
      p.respawnAt = now + 2200;
      const g = useGame.getState();
      g.set({ deaths: g.deaths + 1 });
    }
  }

  useFrame((_s, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const now = performance.now();
    const playing = useGame.getState().status === "playing";
    const p = player.current;

    if (p.reloadUntil && now >= p.reloadUntil) {
      const wp = WEAPONS[p.weapon];
      const need = wp.mag - p.ammo;
      const take = Math.min(need, p.reserve[p.weapon] || 0);
      p.ammo += take;
      p.reserve[p.weapon] = (p.reserve[p.weapon] || 0) - take;
      p.reloadUntil = 0;
      useGame.getState().set({ ammo: p.ammo, reloading: false });
    }
    if (!p.alive && now >= p.respawnAt) respawnPlayer();

    if (playing && p.alive) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const fwd = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      const wish = new THREE.Vector3();
      if (keys.current["KeyW"]) wish.add(fwd);
      if (keys.current["KeyS"]) wish.sub(fwd);
      if (keys.current["KeyD"]) wish.add(right);
      if (keys.current["KeyA"]) wish.sub(right);
      const crouch = !!keys.current["ControlLeft"] || !!keys.current["KeyC"];
      const sprint = !!keys.current["ShiftLeft"] && !crouch;
      const speed = crouch ? PLAYER.crouch : sprint ? PLAYER.sprint : PLAYER.walk;
      if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
      const height = crouch ? PLAYER.crouchHeight : PLAYER.height;

      const before = p.pos.clone();
      p.pos.x += wish.x * dt;
      p.pos.z += wish.z * dt;
      const res = resolveHorizontal(solids, [p.pos.x, p.pos.y, p.pos.z], p.pos.y, p.pos.y + height);
      p.pos.x = Math.max(bounds.min[0], Math.min(bounds.max[0], res[0]));
      p.pos.z = Math.max(bounds.min[2], Math.min(bounds.max[2], res[2]));

      const ground = sampleGround(solids, p.pos.x, p.pos.z);
      if (keys.current["Space"] && p.onGround) { p.velY = PLAYER.jump; p.onGround = false; sound.jump(); }
      p.velY += PLAYER.gravity * dt;
      p.pos.y += p.velY * dt;
      if (ground > -Infinity && p.pos.y <= ground + 0.001 && p.velY <= 0) {
        if (!p.wasGround && p.velY < -6) sound.land();
        p.pos.y = ground; p.velY = 0; p.onGround = true;
      } else if (p.pos.y > ground + 0.05) p.onGround = false;
      p.wasGround = p.onGround;
      if (p.pos.y < -25) respawnPlayer();

      const moved = Math.hypot(p.pos.x - before.x, p.pos.z - before.z);
      moveAccum.current += moved;
      if (p.onGround && moved > 0.02 && now - stepAt.current > (sprint ? 320 : 440)) { sound.footstep(); stepAt.current = now; }
      if (now - moveSentAt.current > 3000 && moveAccum.current > 0) { cbs.onMove(moveAccum.current); moveAccum.current = 0; moveSentAt.current = now; }

      const eye = crouch ? PLAYER.crouchEye : PLAYER.eye;
      camera.position.set(p.pos.x, p.pos.y + eye, p.pos.z);

      const wp = WEAPONS[p.weapon];
      if ((firing.current && wp.auto) || wantShot.current) fire(now);
      wantShot.current = false;
    }

    // viewmodel + muzzle flash
    recoil.current *= 0.82;
    if (vmRef.current) {
      vmRef.current.position.copy(camera.position);
      vmRef.current.quaternion.copy(camera.quaternion);
      vmRef.current.translateX(0.22);
      vmRef.current.translateY(-0.22);
      vmRef.current.translateZ(-0.5 + recoil.current);
    }
    if (flashRef.current) flashRef.current.visible = now < flashUntil.current;

    // tracer + spark fade
    for (let i = 0; i < TRACERS; i++) {
      const m = tracerRefs.current[i];
      if (m && m.visible && performance.now() >= tracerPool.current[i].until) m.visible = false;
    }
    for (let i = 0; i < SPARKS; i++) {
      const m = sparkRefs.current[i];
      if (m && m.visible) {
        const left = sparkPool.current[i].until - performance.now();
        if (left <= 0) m.visible = false;
        else m.scale.setScalar(Math.max(0.1, left / 140));
      }
    }

    // bots
    bots.current.forEach((b, i) => {
      const g = botGroups.current[i];
      if (!b.alive) {
        if (now >= b.respawnAt) {
          const s = pickSpawn();
          b.pos.set(s[0], s[1], s[2]);
          b.hp = 100; b.alive = true; b.state.dead = false;
          if (g) g.rotation.set(0, b.yaw, 0);
        }
        if (g) g.position.copy(b.pos);
        return;
      }
      const toP = new THREE.Vector3(p.pos.x - b.pos.x, 0, p.pos.z - b.pos.z);
      const distP = toP.length();
      const engaged = playing && p.alive && distP < 30;
      let mv: THREE.Vector3;
      if (engaged && distP > 8) mv = toP.clone().normalize();
      else if (engaged) {
        // strafe around player
        mv = new THREE.Vector3(-toP.z, 0, toP.x).normalize().multiplyScalar(Math.sin(now / 700 + i) > 0 ? 1 : -1);
      } else {
        if (b.pos.distanceTo(b.target) < 1.5)
          b.target.set(bounds.min[0] + Math.random() * (bounds.max[0] - bounds.min[0]), 0, bounds.min[2] + Math.random() * (bounds.max[2] - bounds.min[2]));
        mv = new THREE.Vector3(b.target.x - b.pos.x, 0, b.target.z - b.pos.z).normalize();
      }
      const bspeed = engaged ? 3.6 : 2.6;
      const nx = b.pos.x + mv.x * bspeed * dt;
      const nz = b.pos.z + mv.z * bspeed * dt;
      const r = resolveHorizontal(solids, [nx, b.pos.y, nz], b.pos.y, b.pos.y + 1.7);
      b.pos.x = Math.max(bounds.min[0], Math.min(bounds.max[0], r[0]));
      b.pos.z = Math.max(bounds.min[2], Math.min(bounds.max[2], r[2]));
      const bg = sampleGround(solids, b.pos.x, b.pos.z);
      b.pos.y = bg > -Infinity ? bg : b.pos.y;

      b.state.moving = bspeed > 0 && (Math.abs(mv.x) + Math.abs(mv.z)) > 0.1;
      b.state.aiming = engaged;
      b.yaw = engaged ? Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z) : Math.atan2(mv.x, mv.z);
      if (g) { g.position.copy(b.pos); g.rotation.y = b.yaw; }

      if (engaged && now >= b.nextShot) {
        b.nextShot = now + 650 + Math.random() * 900;
        const ro: Vec3 = [b.pos.x, b.pos.y + 1.2, b.pos.z];
        const rd = new THREE.Vector3(p.pos.x - b.pos.x, p.pos.y + 1.2 - (b.pos.y + 1.2), p.pos.z - b.pos.z).normalize();
        const rda: Vec3 = [rd.x, rd.y, rd.z];
        let blocked = false;
        for (const sol of solids) { const t = rayAABB(ro, rda, sol); if (t != null && t < distP - 0.5) { blocked = true; break; } }
        if (!blocked && Math.random() < 0.55) damagePlayer(8 + Math.random() * 7, now);
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

      {map.objects.map((o) => <AssetMesh key={o.id} object={o} />)}

      {bots.current.map((b, i) => (
        <group key={b.id} ref={(el) => (botGroups.current[i] = el)}>
          <Fighter palette={enemyPalette(i).palette} weapon={b.weapon} stateRef={botStateRefs[i]} />
        </group>
      ))}

      {/* viewmodel + muzzle flash */}
      <group ref={vmRef}>
        <WeaponModel weaponId={weapon} />
        <group ref={flashRef} position={[0, 0.02, -0.78]} visible={false}>
          <mesh scale={[1, 1, 1.6]}>
            <icosahedronGeometry args={[0.11, 0]} />
            <meshBasicMaterial color="#ffd27a" transparent opacity={0.92} />
          </mesh>
          <pointLight color="#ffcf8a" intensity={6} distance={6} />
        </group>
      </group>

      {/* tracer pool */}
      {Array.from({ length: TRACERS }).map((_, i) => (
        <mesh key={"t" + i} ref={(el) => (tracerRefs.current[i] = el)} visible={false}>
          <boxGeometry args={[0.02, 0.02, 1]} />
          <meshBasicMaterial color="#ffe08a" transparent opacity={0.9} />
        </mesh>
      ))}
      {/* spark pool */}
      {Array.from({ length: SPARKS }).map((_, i) => (
        <mesh key={"s" + i} ref={(el) => (sparkRefs.current[i] = el)} visible={false}>
          <icosahedronGeometry args={[0.12, 0]} />
          <meshBasicMaterial color="#ffd08a" />
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
