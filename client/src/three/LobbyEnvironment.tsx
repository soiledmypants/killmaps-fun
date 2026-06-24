import * as THREE from "three";

// Original industrial shooter-lobby environment from primitives: concrete yard,
// warehouses, shipping containers, crates, chain-link fences and a construction
// crane tower. Gritty, overcast, fogged for depth.
const CONCRETE = "#2e3338";
const CONCRETE_DK = "#23272b";
const METAL = "#474f58";
const METAL_DK = "#343a41";
const CRATE = "#6c5235";
const HAZARD = "#b08a2c";
const FENCE = "#272c31";

function Warehouse({ position, w = 6, h = 4, d = 5, color = METAL }: { position: [number, number, number]; w?: number; h?: number; d?: number; color?: string }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.6} />
      </mesh>
      {/* roof cap */}
      <mesh castShadow position={[0, h + 0.15, 0]}>
        <boxGeometry args={[w + 0.3, 0.3, d + 0.3]} />
        <meshStandardMaterial color={METAL_DK} metalness={0.6} roughness={0.5} />
      </mesh>
      {/* corrugation ribs */}
      {Array.from({ length: Math.round(w / 0.8) }).map((_, i, a) => (
        <mesh key={i} position={[-w / 2 + (i + 0.5) * (w / a.length), h / 2, d / 2 + 0.03]}>
          <boxGeometry args={[0.08, h, 0.06]} />
          <meshStandardMaterial color={METAL_DK} metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      {/* roller door */}
      <mesh position={[0, h * 0.3, d / 2 + 0.05]}>
        <boxGeometry args={[w * 0.4, h * 0.55, 0.1]} />
        <meshStandardMaterial color={CONCRETE_DK} metalness={0.4} roughness={0.7} />
      </mesh>
    </group>
  );
}

function Container({ position, rotation = [0, 0, 0], color }: { position: [number, number, number]; rotation?: [number, number, number]; color: string }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.4, 1.3, 1.2]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.65} />
      </mesh>
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[-1.1 + i * 0.34, 0, 0.61]}>
          <boxGeometry args={[0.06, 1.2, 0.04]} />
          <meshStandardMaterial color="#1c1f22" metalness={0.4} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Crate({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  return (
    <mesh castShadow receiveShadow position={position}>
      <boxGeometry args={[1.1 * s, 1.1 * s, 1.1 * s]} />
      <meshStandardMaterial color={CRATE} roughness={0.9} metalness={0.05} />
    </mesh>
  );
}

function Fence({ position, length = 6, rotation = [0, 0, 0] }: { position: [number, number, number]; length?: number; rotation?: [number, number, number] }) {
  const posts = Math.round(length / 2);
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[length, 2, 0.04]} />
        <meshStandardMaterial color={FENCE} metalness={0.4} roughness={0.6} transparent opacity={0.28} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: posts + 1 }).map((_, i) => (
        <mesh key={i} castShadow position={[-length / 2 + (i * length) / posts, 1, 0]}>
          <boxGeometry args={[0.07, 2.05, 0.07]} />
          <meshStandardMaterial color={METAL_DK} metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function CraneTower({ position }: { position: [number, number, number] }) {
  const seg = 9;
  return (
    <group position={position}>
      {/* lattice mast */}
      {Array.from({ length: seg }).map((_, i) => (
        <group key={i} position={[0, i * 1.2 + 0.6, 0]}>
          {[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([x, z], j) => (
            <mesh key={j} position={[x, 0, z]}>
              <boxGeometry args={[0.08, 1.2, 0.08]} />
              <meshStandardMaterial color={HAZARD} metalness={0.5} roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.05, 1.1, 0.05]} />
            <meshStandardMaterial color={METAL_DK} metalness={0.6} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {/* jib */}
      <mesh castShadow position={[3, seg * 1.2, 0]}>
        <boxGeometry args={[7, 0.5, 0.5]} />
        <meshStandardMaterial color={HAZARD} metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[5.5, seg * 1.2 - 1.4, 0]}>
        <boxGeometry args={[0.06, 2.8, 0.06]} />
        <meshStandardMaterial color={METAL_DK} />
      </mesh>
    </group>
  );
}

export function LobbyEnvironment() {
  return (
    <group>
      {/* ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={CONCRETE} roughness={0.95} metalness={0.05} />
      </mesh>
      {/* hazard floor stripes near the operator */}
      {[-2.4, 2.4].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 1.5]}>
          <planeGeometry args={[0.18, 4]} />
          <meshStandardMaterial color={HAZARD} roughness={0.8} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -0.6]}>
        <ringGeometry args={[1.7, 1.9, 48]} />
        <meshStandardMaterial color={HAZARD} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* background warehouses */}
      <Warehouse position={[-11, 0, -16]} w={9} h={6} d={7} color={METAL} />
      <Warehouse position={[10, 0, -18]} w={11} h={7} d={8} color="#3f474f" />
      <Warehouse position={[-1, 0, -22]} w={8} h={5} d={6} color={METAL_DK} />

      {/* crane */}
      <CraneTower position={[16, 0, -14]} />

      {/* containers */}
      <Container position={[-7.5, 0.65, -7]} color="#3c5560" />
      <Container position={[-7.5, 1.95, -7]} rotation={[0, 0.05, 0]} color="#6e4a3a" />
      <Container position={[8, 0.65, -8]} rotation={[0, -0.3, 0]} color="#4d5340" />

      {/* crates near the operator */}
      <Crate position={[3.4, 0.55, -1.5]} />
      <Crate position={[4.3, 0.55, -2.4]} />
      <Crate position={[3.9, 1.55, -2.0]} s={0.9} />
      <Crate position={[-3.8, 0.55, -2]} s={1.1} />
      <Crate position={[-4.6, 0.55, -3]} />

      {/* fences */}
      <Fence position={[-7, 0, 3]} length={10} rotation={[0, 0.15, 0]} />
      <Fence position={[7, 0, 3]} length={10} rotation={[0, -0.15, 0]} />
      <Fence position={[0, 0, -11]} length={16} />
    </group>
  );
}
