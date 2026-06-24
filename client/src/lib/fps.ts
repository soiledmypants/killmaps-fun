// Lightweight kinematic FPS collision against the map's box/ramp kit. No physics
// engine — deterministic AABB resolution + slope sampling for ramps/stairs so the
// single-player prototype runs anywhere. Walls block; walkable pieces act as ground.
import type { GameMap, MapObject, Vec3 } from "./types";
import { getAsset } from "./assets";

export interface Solid {
  kind: string;
  walkable: boolean;
  cx: number;
  cz: number;
  cy: number;
  hx: number;
  hz: number;
  top: number;
  bottom: number;
  height: number;
  depth: number;
  rotY: number;
}

export const PLAYER = {
  radius: 0.4,
  height: 1.7,
  crouchHeight: 1.05,
  eye: 1.5,
  crouchEye: 0.9,
  step: 0.6,
  gravity: -26,
  jump: 8.6,
  walk: 6,
  sprint: 9.5,
  crouch: 3,
  accel: 12,
};

export function buildSolids(map: GameMap): Solid[] {
  const out: Solid[] = [];
  for (const o of map.objects) {
    const def = getAsset(o.kind);
    if (!def.collidable) continue;
    const w = def.size[0] * o.scale[0];
    const h = def.size[1] * o.scale[1];
    const d = def.size[2] * o.scale[2];
    out.push({
      kind: o.kind,
      walkable: def.walkable,
      cx: o.position[0],
      cz: o.position[2],
      cy: o.position[1],
      hx: w / 2,
      hz: d / 2,
      top: o.position[1] + h / 2,
      bottom: o.position[1] - h / 2,
      height: h,
      depth: d,
      rotY: o.rotation[1] || 0,
    });
  }
  return out;
}

function inFootprint(s: Solid, x: number, z: number, pad = 0): boolean {
  // Approximate yaw rotation by rotating the query point into the solid's frame.
  const dx = x - s.cx;
  const dz = z - s.cz;
  const c = Math.cos(-s.rotY);
  const sn = Math.sin(-s.rotY);
  const lx = dx * c - dz * sn;
  const lz = dx * sn + dz * c;
  return Math.abs(lx) <= s.hx + pad && Math.abs(lz) <= s.hz + pad;
}

/** Height of the support surface of a walkable solid at (x,z), accounting for ramps/stairs. */
function surfaceHeight(s: Solid, x: number, z: number): number {
  if (s.kind === "ramp" || s.kind === "stairs") {
    const dx = x - s.cx;
    const dz = z - s.cz;
    const c = Math.cos(-s.rotY);
    const sn = Math.sin(-s.rotY);
    const lz = dx * sn + dz * c; // local z, slope rises toward +z
    const t = Math.min(1, Math.max(0, (lz + s.depth / 2) / s.depth));
    return s.bottom + t * s.height;
  }
  return s.top;
}

/** Highest walkable surface under the player within step reach (or -Infinity). */
export function sampleGround(solids: Solid[], x: number, z: number): number {
  let g = -Infinity;
  for (const s of solids) {
    if (!s.walkable) continue;
    if (!inFootprint(s, x, z, PLAYER.radius * 0.7)) continue;
    const h = surfaceHeight(s, x, z);
    if (h > g) g = h;
  }
  return g;
}

/** Resolve horizontal movement against blocking solids (walls / tall sides). */
export function resolveHorizontal(solids: Solid[], pos: Vec3, feetY: number, bodyTop: number): Vec3 {
  const p: Vec3 = [pos[0], pos[1], pos[2]];
  for (const s of solids) {
    // vertical overlap with body?
    if (s.bottom > bodyTop || s.top < feetY + 0.05) continue;
    // walkable & low enough to step onto -> not a wall
    if (s.walkable && s.top <= feetY + PLAYER.step) continue;
    if (!inFootprint(s, p[0], p[2], PLAYER.radius)) continue;
    // push out along the smaller-penetration local axis
    const dx = p[0] - s.cx;
    const dz = p[2] - s.cz;
    const c = Math.cos(-s.rotY);
    const sn = Math.sin(-s.rotY);
    let lx = dx * c - dz * sn;
    let lz = dx * sn + dz * c;
    const penX = s.hx + PLAYER.radius - Math.abs(lx);
    const penZ = s.hz + PLAYER.radius - Math.abs(lz);
    if (penX < penZ) lx += Math.sign(lx || 1) * penX;
    else lz += Math.sign(lz || 1) * penZ;
    // back to world
    p[0] = s.cx + lx * Math.cos(s.rotY) - lz * Math.sin(s.rotY);
    p[2] = s.cz + lx * Math.sin(s.rotY) + lz * Math.cos(s.rotY);
  }
  return p;
}

export function mapBounds(map: GameMap): { min: Vec3; max: Vec3 } {
  let minX = -20,
    maxX = 20,
    minZ = -20,
    maxZ = 20;
  for (const o of map.objects) {
    minX = Math.min(minX, o.position[0]);
    maxX = Math.max(maxX, o.position[0]);
    minZ = Math.min(minZ, o.position[2]);
    maxZ = Math.max(maxZ, o.position[2]);
  }
  return { min: [minX - 6, -30, minZ - 6], max: [maxX + 6, 80, maxZ + 6] };
}

// ---- ray helpers for hitscan ----
export function rayAABB(ro: Vec3, rd: Vec3, s: Solid): number | null {
  // axis-aligned (ignores yaw for occlusion — acceptable for the kit)
  const min = [s.cx - s.hx, s.bottom, s.cz - s.hz];
  const max = [s.cx + s.hx, s.top, s.cz + s.hz];
  let tmin = 0;
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const o = ro[i];
    const d = rd[i];
    if (Math.abs(d) < 1e-8) {
      if (o < min[i] || o > max[i]) return null;
    } else {
      let t1 = (min[i] - o) / d;
      let t2 = (max[i] - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

export function raySphere(ro: Vec3, rd: Vec3, center: Vec3, radius: number): number | null {
  const ox = ro[0] - center[0];
  const oy = ro[1] - center[1];
  const oz = ro[2] - center[2];
  const b = ox * rd[0] + oy * rd[1] + oz * rd[2];
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

export type WeaponCategory = "assault" | "smg" | "pistol" | "shotgun" | "sniper";

export interface WeaponDef {
  name: string;
  category: WeaponCategory;
  damage: number;
  fireRate: number; // shots / sec
  mag: number;
  reserve: number; // spare rounds
  reload: number; // seconds
  spread: number;
  auto: boolean;
  range: number;
  headshotMult: number;
  pellets?: number;
  scoped?: boolean;
}

// Original weapons inspired by tactical-shooter archetypes — no copyrighted models.
export const WEAPONS: Record<string, WeaponDef> = {
  ak: { name: "VK-47", category: "assault", damage: 30, fireRate: 9, mag: 30, reserve: 90, reload: 2.2, spread: 0.016, auto: true, range: 130, headshotMult: 2.6 },
  m4: { name: "MK-4", category: "assault", damage: 26, fireRate: 10.5, mag: 30, reserve: 90, reload: 2.0, spread: 0.012, auto: true, range: 130, headshotMult: 2.5 },
  mp5: { name: "SP-5", category: "smg", damage: 20, fireRate: 13, mag: 30, reserve: 120, reload: 1.8, spread: 0.018, auto: true, range: 80, headshotMult: 2.2 },
  ump: { name: "UM-9", category: "smg", damage: 24, fireRate: 10, mag: 25, reserve: 100, reload: 1.9, spread: 0.02, auto: true, range: 85, headshotMult: 2.2 },
  glock: { name: "G-18", category: "pistol", damage: 26, fireRate: 6, mag: 17, reserve: 68, reload: 1.4, spread: 0.022, auto: false, range: 70, headshotMult: 2.4 },
  deagle: { name: "Hand Cannon", category: "pistol", damage: 58, fireRate: 2.6, mag: 7, reserve: 35, reload: 1.7, spread: 0.018, auto: false, range: 90, headshotMult: 2.8 },
  pump: { name: "Breacher", category: "shotgun", damage: 15, fireRate: 1.2, mag: 7, reserve: 28, reload: 2.6, spread: 0.085, auto: false, range: 38, headshotMult: 1.6, pellets: 9 },
  awp: { name: "Longshot", category: "sniper", damage: 120, fireRate: 0.8, mag: 5, reserve: 20, reload: 3.0, spread: 0.002, auto: false, range: 300, headshotMult: 1.5, scoped: true },
};

export type WeaponId = string;
export const ALL_WEAPONS: WeaponId[] = Object.keys(WEAPONS);
export const DEFAULT_ALLOWED: WeaponId[] = ["m4", "ak", "mp5", "glock", "pump", "awp"];

export interface MatchRules {
  allowed_weapons: WeaponId[];
  starting_weapon: WeaponId;
  health: number;
  armor: number;
  reserve_mult: number;
}

export function defaultRules(): MatchRules {
  return { allowed_weapons: [...DEFAULT_ALLOWED], starting_weapon: "m4", health: 100, armor: 0, reserve_mult: 1 };
}

export function resolveRules(map: { rules?: Partial<MatchRules> }): MatchRules {
  const d = defaultRules();
  const r = map.rules || {};
  const allowed = (r.allowed_weapons && r.allowed_weapons.filter((w) => WEAPONS[w]).length ? r.allowed_weapons.filter((w) => WEAPONS[w]) : d.allowed_weapons);
  const start = r.starting_weapon && allowed.includes(r.starting_weapon) ? r.starting_weapon : allowed[0];
  return {
    allowed_weapons: allowed,
    starting_weapon: start,
    health: r.health && r.health > 0 ? r.health : d.health,
    armor: r.armor != null ? r.armor : d.armor,
    reserve_mult: r.reserve_mult || 1,
  };
}

export function spawnsOf(map: GameMap): Vec3[] {
  return spawnsWithFacing(map).map((s) => s.pos);
}

export interface SpawnPoint {
  pos: Vec3;
  yaw: number; // facing direction (radians)
  team: "A" | "B" | null;
}

/** Spawn points with their creator-set facing direction. */
export function spawnsWithFacing(map: GameMap): SpawnPoint[] {
  const s = map.objects
    .filter((o: MapObject) => o.kind === "spawn" || o.kind === "team_spawn")
    .map((o) => ({
      pos: [o.position[0], o.position[1] + 0.1, o.position[2]] as Vec3,
      yaw: o.rotation?.[1] || 0,
      team: (o.settings?.team as "A" | "B") || null,
    }));
  return s.length ? s : [{ pos: [0, 1, 0], yaw: 0, team: null }];
}
