import { GroupProps } from "@react-three/fiber";

const GUNMETAL = "#262b30";
const POLY = "#14171a";

/** Compact tactical pistol from primitives. Reusable group. */
export function PistolModel(props: GroupProps) {
  return (
    <group {...props}>
      {/* slide */}
      <mesh castShadow position={[0, 0.02, -0.05]}>
        <boxGeometry args={[0.06, 0.1, 0.36]} />
        <meshStandardMaterial color={GUNMETAL} metalness={0.75} roughness={0.35} />
      </mesh>
      {/* frame / grip */}
      <mesh castShadow position={[0, -0.16, 0.05]} rotation={[0.32, 0, 0]}>
        <boxGeometry args={[0.06, 0.22, 0.1]} />
        <meshStandardMaterial color={POLY} metalness={0.2} roughness={0.85} />
      </mesh>
      {/* barrel */}
      <mesh castShadow position={[0, 0.03, -0.26]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.12, 8]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* trigger guard */}
      <mesh position={[0, -0.06, 0.02]}>
        <torusGeometry args={[0.04, 0.012, 8, 16]} />
        <meshStandardMaterial color={GUNMETAL} metalness={0.6} roughness={0.5} />
      </mesh>
    </group>
  );
}
