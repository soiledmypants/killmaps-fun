import { GroupProps } from "@react-three/fiber";

// Original third-person tactical weapon models from primitives (no ripped assets).
const GUNMETAL = "#262b30";
const POLY = "#14171a";
const RAIL = "#34404a";

/** Carbine-style rifle, ~1.0 units long, barrel pointing -Z. Reusable group. */
export function RifleModel(props: GroupProps) {
  return (
    <group {...props}>
      {/* receiver / body */}
      <mesh castShadow>
        <boxGeometry args={[0.09, 0.14, 0.62]} />
        <meshStandardMaterial color={GUNMETAL} metalness={0.7} roughness={0.4} />
      </mesh>
      {/* handguard */}
      <mesh castShadow position={[0, 0.01, -0.42]}>
        <boxGeometry args={[0.075, 0.1, 0.34]} />
        <meshStandardMaterial color={POLY} metalness={0.3} roughness={0.6} />
      </mesh>
      {/* barrel */}
      <mesh castShadow position={[0, 0.03, -0.72]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.4, 10]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* optic */}
      <mesh castShadow position={[0, 0.12, 0.02]}>
        <boxGeometry args={[0.04, 0.06, 0.16]} />
        <meshStandardMaterial color={RAIL} metalness={0.6} roughness={0.5} />
      </mesh>
      {/* magazine */}
      <mesh castShadow position={[0, -0.16, -0.05]} rotation={[-0.18, 0, 0]}>
        <boxGeometry args={[0.06, 0.22, 0.1]} />
        <meshStandardMaterial color={POLY} metalness={0.3} roughness={0.7} />
      </mesh>
      {/* grip */}
      <mesh castShadow position={[0, -0.14, 0.16]} rotation={[0.45, 0, 0]}>
        <boxGeometry args={[0.055, 0.16, 0.07]} />
        <meshStandardMaterial color={POLY} roughness={0.8} />
      </mesh>
      {/* stock */}
      <mesh castShadow position={[0, -0.02, 0.42]}>
        <boxGeometry args={[0.06, 0.13, 0.26]} />
        <meshStandardMaterial color={POLY} roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Pump shotgun, reusable group. */
export function ShotgunModel(props: GroupProps) {
  return (
    <group {...props}>
      <mesh castShadow>
        <boxGeometry args={[0.1, 0.13, 0.95]} />
        <meshStandardMaterial color={POLY} metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.06, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.034, 0.034, 0.7, 10]} />
        <meshStandardMaterial color={GUNMETAL} metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[0, -0.05, -0.12]}>
        <boxGeometry args={[0.075, 0.08, 0.42]} />
        <meshStandardMaterial color={RAIL} metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0, -0.15, 0.22]} rotation={[0.42, 0, 0]}>
        <boxGeometry args={[0.06, 0.16, 0.1]} />
        <meshStandardMaterial color={POLY} roughness={0.8} />
      </mesh>
    </group>
  );
}
