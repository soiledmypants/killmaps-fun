import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import type { GameMap, Vec3 } from "../lib/types";
import { getAsset } from "../lib/assets";
import { AssetMesh } from "./AssetMesh";
import { Viewmodel } from "./Viewmodel";
import { useGame } from "../lib/gameStore";
import {
  buildSolids, sampleGround, resolveHorizontal, mapBounds, rayAABB, raySphere,
  spawnsOf, PLAYER, WEAPONS, type Solid, type WeaponId,
} from "../lib/fps";

const LIGHT: Record<string, { sky: string; ground: string; sun: number; amb: number; fog: string; far: number }> = {
  warehouse: { sky: "#3a4250", ground: "#0c0e12", sun: 1.0, amb: 0.55, fog: "#0b0e13", far: 120 },
  indoor: { sky: "#2b3038", ground: "#0a0c0f", sun: 0.7, amb: 0.6, fog: "#090b0e", far: 90 },
  dusk: { sky: "#6b4a3a", ground: "#11100f", sun: 0.9, amb: 0.4, fog: "#1a120c", far: 110 },
  night: { sky: "#1a2230", ground: "#070809", sun: 0.35, amb: 0.3, fog: "#05070a", far: 70 },
};

interface Bot {
  id: string;
  name: string;
  pos: THREE.Vector3;
  hp: number;
  alive: boolean;
  respawnAt: number;
  target: THREE.Vector3;
  nextShot: number;
}

interface Cbs {
  onKill: (info: { weapon: string; selfDeath?: boolean; ctx: Record<string, number> }) => void;
  onMove: (distance: number) => void;
}

function BotMesh() {
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.9, 4, 10]} />
        <meshStandardMaterial color="#b3382f" metalness={0.2} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.65, 0]} castShadow>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial color="#d9534f" metalness={0.2} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.66, 0.2]}>
        <boxGeometry args={[0.28, 0.08, 0.05]} />
        <meshBasicMaterial color="#ffcaca" />
      </mesh>
    </group>
  );
}

function Arena({ map, test, cbs }: { map: GameMap; test: boolean; cbs: Cbs }) {
  const { camera } = useThree();
  const solids = useMemo<Solid[]>(() => buildSolids(map), [map]);
  const spawns = useMemo<Vec3[]>(() => spawnsOf(map), [map]);
  const bounds = useMemo(() => mapBounds(map), [map]);
  const preset = LIGHT[map.lighting?.preset || "warehouse"] || LIGHT.warehouse;
  const lights = useMemo(() => map.objects.filter((o) => o.kind === "light"), [map]);

  const weapon = useGame((s) => s.weapon);
  const botRefs = useRef<(THREE.Group | null)[]>([]);
  const vmRef = useRef<THREE.Group>(null);
  const recoil = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const firing = useRef(false);
  const wantShot = useRef(false);
  const moveAccum = useRef(0);
  const moveSentAt = useRef(0);

  const pickSpawn = () => spawns[Math.floor(Math.random() * spawns.length)];

  const bots = useRef<Bot[]>(
    Array.from({ length: 5 }).map((_, i) => {
      const s = spawns[i % spawns.length];
      return {
        id: "bot" + i,
        name: "Bot-" + String(i + 1).padStart(2, "0"),
        pos: new THREE.Vector3(s[0], s[1], s[2]),
        hp: 100,
        alive: true,
        respawnAt: 0,
        target: new THREE.Vector3(s[0], s[1], s[2]),
        nextShot: 0,
      };
    })
  );

  const player = useRef({
    pos: new THREE.Vector3(...pickSpawn()),
    velY: 0,
    onGround: false,
    alive: true,
    respawnAt: 0,
    lastShot: 0,
    reloadUntil: 0,
    ammo: WEAPONS[weapon].mag,
    weapon: weapon as WeaponId,
    health: 100,
    spawnAt: performance.now(),
    shots: 0,
    hits: 0,
  });

  // input
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "KeyR") reload();
      if (e.code === "Digit1") switchWeapon("rifle");
      if (e.code === "Digit2") switchWeapon("pistol");
      if (e.code === "Digit3") switchWeapon("shotgun");
    };
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    const md = (e: MouseEvent) => {
      if (e.button === 0) {
        firing.current = true;
        wantShot.current = true;
      }
    };
    const mu = (e: MouseEvent) => {
      if (e.button === 0) firing.current = false;
    };
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
  }, []);

  function switchWeapon(w: WeaponId) {
    player.current.weapon = w;
    player.current.ammo = WEAPONS[w].mag;
    player.current.reloadUntil = 0;
    useGame.getState().set({ weapon: w, ammo: WEAPONS[w].mag, mag: WEAPONS[w].mag, reloading: false });
  }

  function reload() {
    const p = player.current;
    const wp = WEAPONS[p.weapon];
    if (p.ammo >= wp.mag || p.reloadUntil) return;
    p.reloadUntil = performance.now() + wp.reload * 1000;
    useGame.getState().set({ reloading: true });
  }

  function respawnPlayer() {
    const s = pickSpawn();
    player.current.pos.set(s[0], s[1] + 0.2, s[2]);
    player.current.velY = 0;
    player.current.health = 100;
    player.current.alive = true;
    player.current.spawnAt = performance.now();
    useGame.getState().set({ health: 100 });
  }

  function fire(now: number) {
    const p = player.current;
    const wp = WEAPONS[p.weapon];
    if (p.reloadUntil || p.ammo <= 0) {
      if (p.ammo <= 0) reload();
      return;
    }
    if (now - p.lastShot < 1000 / wp.fireRate) return;
    p.lastShot = now;
    p.ammo -= 1;
    p.shots += 1;
    recoil.current = Math.min(0.12, recoil.current + 0.06);
    useGame.getState().set({ ammo: p.ammo });

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const ro: Vec3 = [camera.position.x, camera.position.y, camera.position.z];
    const pellets = (wp as any).pellets || 1;
    let hitAny = false;
    for (let s = 0; s < pellets; s++) {
      const rd = dir.clone();
      rd.x += (Math.random() - 0.5) * wp.spread * 2;
      rd.y += (Math.random() - 0.5) * wp.spread * 2;
      rd.z += (Math.random() - 0.5) * wp.spread * 2;
      rd.normalize();
      const rda: Vec3 = [rd.x, rd.y, rd.z];

      // nearest wall distance (occlusion)
      let wallT: number = wp.range;
      for (const sol of solids) {
        const t = rayAABB(ro, rda, sol);
        if (t != null && t < wallT) wallT = t;
      }
      // nearest bot
      let bestT = Infinity;
      let bestBot: Bot | null = null;
      for (const b of bots.current) {
        if (!b.alive) continue;
        const center: Vec3 = [b.pos.x, b.pos.y + 1.0, b.pos.z];
        const t = raySphere(ro, rda, center, 0.55);
        if (t != null && t < bestT && t < wallT) {
          bestT = t;
          bestBot = b;
        }
      }
      if (bestBot) {
        bestBot.hp -= wp.damage;
        hitAny = true;
        if (bestBot.hp <= 0) killBot(bestBot, now);
      }
    }
    if (hitAny) {
      p.hits += 1;
      useGame.getState().set({ hitMarker: now });
    }
  }

  function killBot(b: Bot, now: number) {
    b.alive = false;
    b.respawnAt = now + 2500;
    const p = player.current;
    const elapsed = (now - p.spawnAt) / 1000;
    const acc = p.shots ? p.hits / p.shots : 0;
    cbs.onKill({
      weapon: p.weapon,
      ctx: {
        time_since_spawn_ms: now - p.spawnAt,
        fire_rate: WEAPONS[p.weapon].fireRate,
        accuracy: +acc.toFixed(3),
        killer_distance: Math.round(moveAccum.current + 0),
        elapsed,
      },
    });
    const g = useGame.getState();
    g.set({ kills: g.kills + 1, score: g.score + 100 });
    g.pushFeed({ killer: "You", victim: b.name, weapon: p.weapon });
  }

  function botHitsPlayer(b: Bot, now: number) {
    const p = player.current;
    if (!p.alive) return;
    p.health -= 9 + Math.random() * 6;
    useGame.getState().set({ health: Math.max(0, Math.round(p.health)) });
    if (p.health <= 0) {
      p.alive = false;
      p.respawnAt = now + 1800;
      const g = useGame.getState();
      g.set({ deaths: g.deaths + 1 });
      g.pushFeed({ killer: b.name, victim: "You", weapon: "rifle", self: true });
    }
  }

  useFrame((state, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const now = performance.now();
    const playing = useGame.getState().status === "playing";
    const p = player.current;

    // ---- reload completion ----
    if (p.reloadUntil && now >= p.reloadUntil) {
      p.reloadUntil = 0;
      p.ammo = WEAPONS[p.weapon].mag;
      useGame.getState().set({ ammo: p.ammo, reloading: false });
    }

    // ---- player respawn ----
    if (!p.alive && now >= p.respawnAt) respawnPlayer();

    if (playing && p.alive) {
      // movement input (camera-yaw relative)
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const fwd = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      const wish = new THREE.Vector3();
      if (keys.current["KeyW"]) wish.add(fwd);
      if (keys.current["KeyS"]) wish.sub(fwd);
      if (keys.current["KeyD"]) wish.add(right);
      if (keys.current["KeyA"]) wish.sub(right);
      const crouching = !!keys.current["ControlLeft"] || !!keys.current["KeyC"];
      const sprinting = !!keys.current["ShiftLeft"] && !crouching;
      const speed = crouching ? PLAYER.crouch : sprinting ? PLAYER.sprint : PLAYER.walk;
      if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

      const before = p.pos.clone();
      const height = crouching ? PLAYER.crouchHeight : PLAYER.height;

      // horizontal move + collide
      p.pos.x += wish.x * dt;
      p.pos.z += wish.z * dt;
      const resolved = resolveHorizontal(solids, [p.pos.x, p.pos.y, p.pos.z], p.pos.y, p.pos.y + height);
      p.pos.x = resolved[0];
      p.pos.z = resolved[2];
      p.pos.x = Math.max(bounds.min[0], Math.min(bounds.max[0], p.pos.x));
      p.pos.z = Math.max(bounds.min[2], Math.min(bounds.max[2], p.pos.z));

      // vertical
      const ground = sampleGround(solids, p.pos.x, p.pos.z);
      if (keys.current["Space"] && p.onGround) {
        p.velY = PLAYER.jump;
        p.onGround = false;
      }
      p.velY += PLAYER.gravity * dt;
      p.pos.y += p.velY * dt;
      if (ground > -Infinity && p.pos.y <= ground + 0.001 && p.velY <= 0) {
        p.pos.y = ground;
        p.velY = 0;
        p.onGround = true;
      } else if (p.pos.y > ground + 0.05) {
        p.onGround = false;
      }
      if (p.pos.y < -25) respawnPlayer();

      // accumulate distance for anti-farm movement reporting
      const moved = Math.hypot(p.pos.x - before.x, p.pos.z - before.z);
      moveAccum.current += moved;
      if (now - moveSentAt.current > 3000 && moveAccum.current > 0) {
        cbs.onMove(moveAccum.current);
        moveAccum.current = 0;
        moveSentAt.current = now;
      }

      // camera follows player eye
      const eye = crouching ? PLAYER.crouchEye : PLAYER.eye;
      camera.position.set(p.pos.x, p.pos.y + eye, p.pos.z);

      // shooting
      const wp = WEAPONS[p.weapon];
      if ((firing.current && wp.auto) || wantShot.current) fire(now);
      wantShot.current = false;
    }

    // recoil decay + viewmodel placement
    recoil.current *= 0.82;
    if (vmRef.current) {
      vmRef.current.position.copy(camera.position);
      vmRef.current.quaternion.copy(camera.quaternion);
      vmRef.current.translateX(0.28);
      vmRef.current.translateY(-0.26);
      vmRef.current.translateZ(-0.55 + recoil.current);
    }

    // ---- bots ----
    bots.current.forEach((b, i) => {
      const ref = botRefs.current[i];
      if (!b.alive) {
        if (ref) ref.visible = false;
        if (now >= b.respawnAt) {
          const s = spawns[Math.floor(Math.random() * spawns.length)];
          b.pos.set(s[0], s[1], s[2]);
          b.hp = 100;
          b.alive = true;
        }
        return;
      }
      if (ref) ref.visible = true;
      // simple AI: approach the player when in range, else wander
      const toP = new THREE.Vector3(p.pos.x - b.pos.x, 0, p.pos.z - b.pos.z);
      const distP = toP.length();
      let mv: THREE.Vector3;
      if (playing && p.alive && distP < 28) {
        mv = toP.normalize();
      } else {
        if (b.pos.distanceTo(b.target) < 1.5) {
          b.target.set(
            bounds.min[0] + Math.random() * (bounds.max[0] - bounds.min[0]),
            0,
            bounds.min[2] + Math.random() * (bounds.max[2] - bounds.min[2])
          );
        }
        mv = new THREE.Vector3(b.target.x - b.pos.x, 0, b.target.z - b.pos.z).normalize();
      }
      const bspeed = 3.2;
      const nx = b.pos.x + mv.x * bspeed * dt;
      const nz = b.pos.z + mv.z * bspeed * dt;
      const res = resolveHorizontal(solids, [nx, b.pos.y, nz], b.pos.y, b.pos.y + 1.7);
      b.pos.x = Math.max(bounds.min[0], Math.min(bounds.max[0], res[0]));
      b.pos.z = Math.max(bounds.min[2], Math.min(bounds.max[2], res[2]));
      const bg = sampleGround(solids, b.pos.x, b.pos.z);
      b.pos.y = bg > -Infinity ? bg : b.pos.y;
      if (ref) {
        ref.position.copy(b.pos);
        ref.rotation.y = Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
      }
      // bot fires at player
      if (playing && p.alive && distP < 26 && now >= b.nextShot) {
        b.nextShot = now + 700 + Math.random() * 900;
        // line of sight: no wall between
        const ro: Vec3 = [b.pos.x, b.pos.y + 1.2, b.pos.z];
        const rd = new THREE.Vector3(p.pos.x - b.pos.x, p.pos.y + 1.2 - (b.pos.y + 1.2), p.pos.z - b.pos.z).normalize();
        const rda: Vec3 = [rd.x, rd.y, rd.z];
        let blocked = false;
        for (const sol of solids) {
          const t = rayAABB(ro, rda, sol);
          if (t != null && t < distP - 0.5) {
            blocked = true;
            break;
          }
        }
        if (!blocked && Math.random() < 0.6) botHitsPlayer(b, now);
      }
    });
  });

  return (
    <>
      <color attach="background" args={[preset.ground]} />
      <fog attach="fog" args={[preset.fog, 20, preset.far]} />
      <hemisphereLight args={[preset.sky, preset.ground, preset.amb]} />
      <directionalLight position={[40, 60, 25]} intensity={preset.sun} castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-80, 80, 80, -80, 0.1, 250]} />
      </directionalLight>
      {lights.map((o) => (
        <pointLight key={o.id} position={[o.position[0], o.position[1] + 0.5, o.position[2]]} intensity={(o.settings?.intensity || 1) * 8} distance={18} color={o.color || "#ffd98a"} />
      ))}

      {map.objects.map((o) => (
        <AssetMesh key={o.id} object={o} />
      ))}

      {bots.current.map((b, i) => (
        <group key={b.id} ref={(el) => (botRefs.current[i] = el)}>
          <BotMesh />
        </group>
      ))}

      <group ref={vmRef}>
        <Viewmodel weapon={weapon} />
      </group>

      <PointerLockControls
        onLock={() => useGame.getState().set({ status: "playing" })}
        onUnlock={() => {
          if (useGame.getState().status === "playing") useGame.getState().set({ status: "ready" });
        }}
      />
    </>
  );
}

export function FPSScene({ map, test, cbs }: { map: GameMap; test: boolean; cbs: Cbs }) {
  return (
    <Canvas shadows camera={{ fov: 78, near: 0.05, far: 300, position: [0, 2, 0] }} dpr={[1, 2]}>
      <Arena map={map} test={test} cbs={cbs} />
    </Canvas>
  );
}
