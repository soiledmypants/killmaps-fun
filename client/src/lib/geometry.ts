import type { GameMap, MapObject, Vec3 } from "./types";
import { getAsset } from "./assets";

export function uid(prefix = "obj"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** World-space axis-aligned bounding box for a placed object (ignores rotation for
 *  collision simplicity — fine for the box-based tactical kit). */
export function objectAABB(o: MapObject): { min: Vec3; max: Vec3 } {
  const def = getAsset(o.kind);
  const sx = (def.size[0] * o.scale[0]) / 2;
  const sy = (def.size[1] * o.scale[1]) / 2;
  const sz = (def.size[2] * o.scale[2]) / 2;
  const [x, y, z] = o.position;
  return { min: [x - sx, y - sy, z - sz], max: [x + sx, y + sy, z + sz] };
}

/** Collidable solids in a map, as AABBs, for the FPS controller. */
export function collisionBoxes(map: GameMap) {
  return map.objects
    .filter((o) => getAsset(o.kind).collidable)
    .map((o) => ({ id: o.id, kind: o.kind, walkable: getAsset(o.kind).walkable, ...objectAABB(o) }));
}

export function spawnPositions(map: GameMap): Vec3[] {
  const fromObjects = map.objects
    .filter((o) => o.kind === "spawn" || o.kind === "team_spawn")
    .map((o) => [o.position[0], o.position[1] + 1, o.position[2]] as Vec3);
  if (fromObjects.length) return fromObjects;
  if (map.spawn_points?.length) return map.spawn_points.map((s) => [s.position[0], s.position[1] + 1, s.position[2]] as Vec3);
  return [[0, 2, 0]];
}

/** A fresh empty map seeded with a floor grid + one spawn so it's instantly playable. */
export function blankMap(creator: string, username: string): GameMap {
  const now = Date.now();
  const objects: MapObject[] = [];
  // 3x3 concrete floor pad
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      objects.push({
        id: uid(),
        kind: "floor",
        position: [x * 8, 0, z * 8],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      });
    }
  }
  objects.push({ id: uid(), kind: "spawn", position: [0, 0.3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
  return {
    map_id: uid("map"),
    creator,
    creator_username: username,
    title: "Untitled Arena",
    description: "",
    thumbnail: null,
    objects,
    spawn_points: [],
    lighting: { preset: "forest", intensity: 1 },
    published: false,
    test_mode: false,
    created_at: now,
    updated_at: now,
    stats: { plays: 0, total_kills: 0, verified_kills: 0, unique_verified_players: 0 },
    reward_stats: { creator_points: 0 },
  };
}

export function snapVec(v: Vec3, size: number): Vec3 {
  if (!size) return v;
  return [Math.round(v[0] / size) * size, v[1], Math.round(v[2] / size) * size];
}
