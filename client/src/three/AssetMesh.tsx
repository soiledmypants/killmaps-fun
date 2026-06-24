import { useMemo } from "react";
import * as THREE from "three";
import type { MapObject } from "../lib/types";
import { getAsset } from "../lib/assets";

/** Right-triangular prism (ramp): slopes up along +Z, extruded along X. Centered. */
function wedgeGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const x = w / 2,
    y = h / 2,
    z = d / 2;
  // cross-section triangle in (z,y): A(-z,-y) B(z,-y) C(z,y), extruded x:[-x,x]
  const v = [
    [-x, -y, -z], [-x, -y, z], [-x, y, z], // left face triangle
    [x, -y, -z], [x, -y, z], [x, y, z], // right face triangle
  ];
  const idx = [
    0, 1, 2, // left
    3, 5, 4, // right
    0, 2, 5, 0, 5, 3, // sloped top
    0, 3, 4, 0, 4, 1, // bottom
    1, 4, 5, 1, 5, 2, // back (tall) face
  ];
  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  for (const i of idx) pos.push(...v[i]);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

function material(kind: string, color: string): THREE.MeshStandardMaterial {
  const def = getAsset(kind);
  const c = new THREE.Color(color || def.color);
  const m = new THREE.MeshStandardMaterial({ color: c, flatShading: true });
  if (kind === "wall" || kind === "platform" || kind === "elevated_platform" || kind === "fence" || kind === "obstacle") {
    m.metalness = 0.55;
    m.roughness = 0.5;
  } else if (kind === "barrel") {
    m.metalness = 0.6;
    m.roughness = 0.4;
  } else if (kind === "crate") {
    m.metalness = 0.05;
    m.roughness = 0.85;
  } else {
    m.metalness = 0.1;
    m.roughness = 0.9;
  }
  return m;
}

export function AssetMesh({ object, selected = false, ghost = false }: { object: MapObject; selected?: boolean; ghost?: boolean }) {
  const def = getAsset(object.kind);
  const [w, h, d] = [def.size[0] * object.scale[0], def.size[1] * object.scale[1], def.size[2] * object.scale[2]];
  const color = object.color || def.color;
  const mat = useMemo(() => material(object.kind, color), [object.kind, color]);
  const wedge = useMemo(() => (def.shape === "ramp" ? wedgeGeometry(w, h, d) : null), [def.shape, w, h, d]);

  const opacity = ghost ? 0.45 : 1;
  if (ghost) {
    mat.transparent = true;
    mat.opacity = 0.45;
  }

  let body: JSX.Element;
  switch (def.shape) {
    case "cylinder":
      body = (
        <mesh castShadow receiveShadow material={mat}>
          <cylinderGeometry args={[w / 2, w / 2, h, 16]} />
        </mesh>
      );
      break;
    case "ramp":
      body = <mesh castShadow receiveShadow geometry={wedge!} material={mat} />;
      break;
    case "stairs": {
      const steps = 5;
      body = (
        <group>
          {Array.from({ length: steps }).map((_, i) => {
            const sh = h / steps;
            const sd = d / steps;
            return (
              <mesh key={i} castShadow receiveShadow material={mat} position={[0, -h / 2 + sh * (i + 0.5), -d / 2 + sd * (i + 0.5)]}>
                <boxGeometry args={[w, sh, d - sd * i]} />
              </mesh>
            );
          })}
        </group>
      );
      break;
    }
    case "fence": {
      body = (
        <group>
          <mesh material={mat}>
            <boxGeometry args={[w, h, d]} />
          </mesh>
          {Array.from({ length: Math.max(2, Math.round(w / 1)) }).map((_, i, a) => (
            <mesh key={i} position={[-w / 2 + (w * i) / (a.length - 1), 0, 0]} material={mat}>
              <boxGeometry args={[0.08, h, d * 1.2]} />
            </mesh>
          ))}
        </group>
      );
      break;
    }
    case "frame": {
      // wall with a passable opening: 2 jambs + lintel (+ sill for window)
      const openW = Math.min(w * 0.5, 2);
      const isWindow = object.kind === "window";
      const sideW = (w - openW) / 2;
      const headH = isWindow ? h * 0.3 : h * 0.25;
      const sillH = isWindow ? h * 0.4 : 0;
      body = (
        <group>
          <mesh castShadow receiveShadow material={mat} position={[-(openW / 2 + sideW / 2), 0, 0]}>
            <boxGeometry args={[sideW, h, d]} />
          </mesh>
          <mesh castShadow receiveShadow material={mat} position={[openW / 2 + sideW / 2, 0, 0]}>
            <boxGeometry args={[sideW, h, d]} />
          </mesh>
          <mesh castShadow receiveShadow material={mat} position={[0, h / 2 - headH / 2, 0]}>
            <boxGeometry args={[openW, headH, d]} />
          </mesh>
          {sillH > 0 && (
            <mesh castShadow receiveShadow material={mat} position={[0, -h / 2 + sillH / 2, 0]}>
              <boxGeometry args={[openW, sillH, d]} />
            </mesh>
          )}
        </group>
      );
      break;
    }
    case "marker": {
      const team = object.settings?.team;
      const mc = object.kind === "team_spawn" ? (team === "B" ? "#ff3b30" : "#3b82f6") : "#f5a623";
      body = (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -h / 2 + 0.02, 0]}>
            <ringGeometry args={[w * 0.35, w * 0.5, 24]} />
            <meshBasicMaterial color={mc} transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 2.4, 6]} />
            <meshBasicMaterial color={mc} transparent opacity={0.35} />
          </mesh>
        </group>
      );
      break;
    }
    case "pickup": {
      const pc = def.color;
      body = (
        <group position={[0, 0.4, 0]}>
          <mesh castShadow rotation={[Math.PI / 4, Math.PI / 4, 0]}>
            <boxGeometry args={[w * 0.7, h * 0.7, d * 0.7]} />
            <meshStandardMaterial color={pc} emissive={pc} emissiveIntensity={0.5} metalness={0.3} roughness={0.4} />
          </mesh>
        </group>
      );
      break;
    }
    case "light":
      body = (
        <mesh>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshBasicMaterial color={def.color} />
        </mesh>
      );
      break;
    default:
      body = (
        <mesh castShadow receiveShadow material={mat}>
          <boxGeometry args={[w, h, d]} />
        </mesh>
      );
  }

  return (
    <group position={object.position} rotation={object.rotation as [number, number, number]}>
      {body}
      {selected && (
        <mesh>
          <boxGeometry args={[w + 0.12, h + 0.12, d + 0.12]} />
          <meshBasicMaterial color="#f5a623" wireframe />
        </mesh>
      )}
      {opacity < 1 && null}
    </group>
  );
}
