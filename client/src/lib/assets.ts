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

// Tactical low-poly palette: concrete, steel, hazard amber, team blue/red.
const CONCRETE = "#5b626b";
const CONCRETE_DARK = "#3d434b";
const STEEL = "#6f7782";
const CRATE = "#7a5a32";
const HAZARD = "#c9962f";

export const ASSETS: AssetDef[] = [
  // ---- structure ----
  { kind: "floor", label: "Floor", category: "structure", size: [8, 0.4, 8], color: CONCRETE_DARK, shape: "box", collidable: true, walkable: true, hint: "Base ground tile" },
  { kind: "wall", label: "Wall", category: "structure", size: [4, 3, 0.4], color: CONCRETE, shape: "box", collidable: true, walkable: false, hint: "Blocking wall segment" },
  { kind: "platform", label: "Platform", category: "structure", size: [4, 0.4, 4], color: STEEL, shape: "box", collidable: true, walkable: true, hint: "Raised flat surface" },
  { kind: "elevated_platform", label: "Elevated Platform", category: "structure", size: [5, 0.4, 5], color: STEEL, shape: "box", collidable: true, walkable: true, hint: "Sniper / overlook deck" },
  { kind: "ramp", label: "Ramp", category: "structure", size: [4, 2, 4], color: CONCRETE, shape: "ramp", collidable: true, walkable: true, hint: "Angled traversal" },
  { kind: "stairs", label: "Stairs", category: "structure", size: [3, 2, 4], color: CONCRETE, shape: "stairs", collidable: true, walkable: true, hint: "Stepped traversal" },
  { kind: "tunnel", label: "Tunnel", category: "structure", size: [4, 3, 6], color: CONCRETE_DARK, shape: "box", collidable: true, walkable: true, hint: "Covered passage (open ends)" },

  // ---- cover ----
  { kind: "crate", label: "Crate", category: "cover", size: [1.4, 1.4, 1.4], color: CRATE, shape: "box", collidable: true, walkable: true, hint: "Chest-high crate cover" },
  { kind: "cover", label: "Cover Block", category: "cover", size: [2, 1.1, 0.6], color: CONCRETE, shape: "box", collidable: true, walkable: true, hint: "Low concrete barrier" },
  { kind: "barrel", label: "Barrel", category: "cover", size: [1, 1.4, 1], color: HAZARD, shape: "cylinder", collidable: true, walkable: false, hint: "Hazard barrel" },
  { kind: "obstacle", label: "Obstacle", category: "cover", size: [1.6, 2, 1.6], color: CONCRETE_DARK, shape: "box", collidable: true, walkable: false, hint: "Blocking obstacle" },
  { kind: "fence", label: "Fence", category: "cover", size: [4, 2, 0.15], color: STEEL, shape: "fence", collidable: true, walkable: false, hint: "See-through chain fence" },

  // ---- openings ----
  { kind: "door", label: "Doorway", category: "openings", size: [2.2, 3, 0.4], color: CONCRETE, shape: "frame", collidable: true, walkable: false, hint: "Wall with a passable doorway" },
  { kind: "window", label: "Window Wall", category: "openings", size: [4, 3, 0.4], color: CONCRETE, shape: "frame", collidable: true, walkable: false, hint: "Wall with a sightline window" },

  // ---- spawns ----
  { kind: "spawn", label: "Spawn Point", category: "spawns", size: [1, 0.1, 1], color: HAZARD, shape: "marker", collidable: false, walkable: false, gameplay: "spawn", hint: "Free-for-all spawn" },
  { kind: "team_spawn", label: "Team Spawn", category: "spawns", size: [1, 0.1, 1], color: "#3b82f6", shape: "marker", collidable: false, walkable: false, gameplay: "team_spawn", hint: "Team A/B spawn (set team in inspector)" },

  // ---- pickups ----
  { kind: "pickup_weapon", label: "Weapon Pickup", category: "pickups", size: [0.8, 0.8, 0.8], color: "#e2b53a", shape: "pickup", collidable: false, walkable: false, gameplay: "pickup_weapon", hint: "Grants a weapon (set in inspector)" },
  { kind: "pickup_ammo", label: "Ammo Pickup", category: "pickups", size: [0.7, 0.5, 0.7], color: "#9aa3ad", shape: "pickup", collidable: false, walkable: false, gameplay: "pickup_ammo", hint: "Restocks ammo" },
  { kind: "pickup_health", label: "Health Pickup", category: "pickups", size: [0.7, 0.6, 0.7], color: "#33d17a", shape: "pickup", collidable: false, walkable: false, gameplay: "pickup_health", hint: "Restores health" },

  // ---- lighting ----
  { kind: "light", label: "Light", category: "lighting", size: [0.5, 0.5, 0.5], color: "#ffd98a", shape: "light", collidable: false, walkable: false, gameplay: "light", hint: "Point light source" },
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
