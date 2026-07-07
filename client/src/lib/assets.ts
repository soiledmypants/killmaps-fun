import type { AssetKind, Vec3 } from "./types";

export type AssetCategory = "structure" | "cover" | "openings" | "spawns" | "pickups" | "lighting";
export type AssetShape = "box" | "cylinder" | "ramp" | "stairs" | "fence" | "frame" | "marker" | "pickup" | "light";

export interface AssetDef {
  kind: AssetKind;
  label: string;
  category: AssetCategory;
  size: Vec3; // default footprint (world units)
  color: string;
  shape: AssetShape;
  collidable: boolean; // participates in FPS collision
  walkable: boolean; // player can stand on top
  gameplay?: "spawn" | "team_spawn" | "pickup_weapon" | "pickup_ammo" | "pickup_health" | "light";
  hint?: string;
}

// Forest battlefield palette: mossy stone, packed dirt, weathered timber, bark.
const STONE = "#6B7A5E"; // moss-covered stone
const DIRT = "#4A3B26"; // packed forest dirt
const TIMBER = "#5C4630"; // weathered timber
const LOG = "#4E3620"; // fallen log bark
const SANDBAG = "#7A6B4A"; // canvas sandbag

export const ASSETS: AssetDef[] = [
  // ---- structure ----
  { kind: "floor", label: "Forest Floor", category: "structure", size: [8, 0.4, 8], color: DIRT, shape: "box", collidable: true, walkable: true, hint: "Packed-dirt ground tile" },
  { kind: "wall", label: "Stone Wall", category: "structure", size: [4, 3, 0.4], color: STONE, shape: "box", collidable: true, walkable: false, hint: "Mossy stone wall segment" },
  { kind: "platform", label: "Timber Platform", category: "structure", size: [4, 0.4, 4], color: TIMBER, shape: "box", collidable: true, walkable: true, hint: "Raised timber deck" },
  { kind: "elevated_platform", label: "Watchtower Deck", category: "structure", size: [5, 0.4, 5], color: TIMBER, shape: "box", collidable: true, walkable: true, hint: "Sniper / overlook deck" },
  { kind: "ramp", label: "Dirt Ramp", category: "structure", size: [4, 2, 4], color: DIRT, shape: "ramp", collidable: true, walkable: true, hint: "Angled traversal" },
  { kind: "stairs", label: "Log Steps", category: "structure", size: [3, 2, 4], color: TIMBER, shape: "stairs", collidable: true, walkable: true, hint: "Stepped traversal" },
  { kind: "tunnel", label: "Foxhole Tunnel", category: "structure", size: [4, 3, 6], color: DIRT, shape: "box", collidable: true, walkable: true, hint: "Covered passage (open ends)" },

  // ---- cover ----
  { kind: "crate", label: "Supply Crate", category: "cover", size: [1.4, 1.4, 1.4], color: TIMBER, shape: "box", collidable: true, walkable: true, hint: "Chest-high crate cover" },
  { kind: "cover", label: "Sandbag Cover", category: "cover", size: [2, 1.1, 0.6], color: SANDBAG, shape: "box", collidable: true, walkable: true, hint: "Low sandbag barrier" },
  { kind: "barrel", label: "Fallen Log", category: "cover", size: [1, 1.4, 1], color: LOG, shape: "cylinder", collidable: true, walkable: false, hint: "Fallen log cover" },
  { kind: "obstacle", label: "Boulder", category: "cover", size: [1.6, 2, 1.6], color: STONE, shape: "box", collidable: true, walkable: false, hint: "Blocking boulder" },
  { kind: "fence", label: "Timber Fence", category: "cover", size: [4, 2, 0.15], color: LOG, shape: "fence", collidable: true, walkable: false, hint: "See-through timber fence" },

  // ---- openings ----
  { kind: "door", label: "Doorway", category: "openings", size: [2.2, 3, 0.4], color: STONE, shape: "frame", collidable: true, walkable: false, hint: "Wall with a passable doorway" },
  { kind: "window", label: "Firing Slit", category: "openings", size: [4, 3, 0.4], color: STONE, shape: "frame", collidable: true, walkable: false, hint: "Wall with a sightline window" },

  // ---- spawns ----
  { kind: "spawn", label: "Foxhole Spawn", category: "spawns", size: [1, 0.1, 1], color: "#D4A017", shape: "marker", collidable: false, walkable: false, gameplay: "spawn", hint: "Free-for-all spawn" },
  { kind: "team_spawn", label: "Team Foxhole", category: "spawns", size: [1, 0.1, 1], color: "#3E8E3E", shape: "marker", collidable: false, walkable: false, gameplay: "team_spawn", hint: "Bull/Bear team spawn (set team in inspector)" },

  // ---- pickups ----
  { kind: "pickup_weapon", label: "Weapon Cache", category: "pickups", size: [0.8, 0.8, 0.8], color: "#D4A017", shape: "pickup", collidable: false, walkable: false, gameplay: "pickup_weapon", hint: "Grants a weapon (set in inspector)" },
  { kind: "pickup_ammo", label: "Ammo Cache", category: "pickups", size: [0.7, 0.5, 0.7], color: "#8B9E7C", shape: "pickup", collidable: false, walkable: false, gameplay: "pickup_ammo", hint: "Restocks ammo" },
  { kind: "pickup_health", label: "Field Medkit", category: "pickups", size: [0.7, 0.6, 0.7], color: "#3ECF3E", shape: "pickup", collidable: false, walkable: false, gameplay: "pickup_health", hint: "Restores health" },

  // ---- lighting ----
  { kind: "light", label: "Camp Lantern", category: "lighting", size: [0.5, 0.5, 0.5], color: "#ffd98a", shape: "light", collidable: false, walkable: false, gameplay: "light", hint: "Warm point light source" },
];

export const ASSET_MAP: Record<string, AssetDef> = Object.fromEntries(ASSETS.map((a) => [a.kind, a]));

export const CATEGORIES: { id: AssetCategory; label: string }[] = [
  { id: "structure", label: "Structure" },
  { id: "cover", label: "Cover" },
  { id: "openings", label: "Openings" },
  { id: "spawns", label: "Spawns" },
  { id: "pickups", label: "Pickups" },
  { id: "lighting", label: "Lighting" },
];

export function getAsset(kind: string): AssetDef {
  return ASSET_MAP[kind] || ASSETS[0];
}

export function isSpawn(kind: AssetKind): boolean {
  return kind === "spawn" || kind === "team_spawn";
}
