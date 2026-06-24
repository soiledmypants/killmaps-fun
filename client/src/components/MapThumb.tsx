import type { GameMap } from "../lib/types";
import { getAsset } from "../lib/assets";

// Top-down tactical schematic of a map's footprint — original procedural thumbnail.
export function MapThumb({ map, className = "" }: { map: GameMap; className?: string }) {
  const objs = map.objects || [];
  let minX = -10,
    maxX = 10,
    minZ = -10,
    maxZ = 10;
  for (const o of objs) {
    minX = Math.min(minX, o.position[0]);
    maxX = Math.max(maxX, o.position[0]);
    minZ = Math.min(minZ, o.position[2]);
    maxZ = Math.max(maxZ, o.position[2]);
  }
  const pad = 4;
  const w = maxX - minX + pad * 2;
  const h = maxZ - minZ + pad * 2;

  const color = (kind: string) => {
    if (kind === "floor") return "#1c2128";
    if (kind === "wall" || kind === "door" || kind === "window") return "#586271";
    if (kind === "spawn") return "#f5a623";
    if (kind === "team_spawn") return "#3b82f6";
    if (kind.startsWith("pickup")) return "#33d17a";
    if (kind === "ramp" || kind === "stairs" || kind === "platform" || kind === "elevated_platform") return "#404a57";
    return "#6b7480";
  };

  return (
    <svg viewBox={`${minX - pad} ${minZ - pad} ${w} ${h}`} className={className} preserveAspectRatio="xMidYMid slice">
      <rect x={minX - pad} y={minZ - pad} width={w} height={h} fill="#0b0e12" />
      {objs.map((o) => {
        const def = getAsset(o.kind);
        const ow = def.size[0] * o.scale[0];
        const od = def.size[2] * o.scale[2];
        if (def.gameplay) {
          return <circle key={o.id} cx={o.position[0]} cy={o.position[2]} r={Math.max(0.6, ow / 2)} fill={color(o.kind)} />;
        }
        return (
          <rect
            key={o.id}
            x={o.position[0] - ow / 2}
            y={o.position[2] - od / 2}
            width={ow}
            height={od}
            fill={color(o.kind)}
            opacity={o.kind === "floor" ? 0.9 : 1}
          />
        );
      })}
    </svg>
  );
}
