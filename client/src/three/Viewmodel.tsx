import type { WeaponId } from "../lib/fps";

// Original FPS viewmodels built from primitives — no ripped assets. Rendered in the
// camera's local space by FPSScene (which positions the wrapping group each frame).
const GUNMETAL = "#23272d";
const POLY = "#15181c";
const ACCENT = "#3a4250";

export function Viewmodel({ weapon }: { weapon: WeaponId }) {
  if (weapon === "pistol")
    return (
      <group>
        <mesh position={[0, 0, -0.1]}>
          <boxGeometry args={[0.07, 0.11, 0.34]} />
          <meshStandardMaterial color={GUNMETAL} metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.16, 0.04]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.07, 0.2, 0.09]} />
          <meshStandardMaterial color={POLY} metalness={0.2} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.02, -0.32]}>
          <cylinderGeometry args={[0.018, 0.018, 0.12, 8]} />
          <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>
    );

  if (weapon === "shotgun")
    return (
      <group>
        <mesh position={[0, 0, -0.25]}>
          <boxGeometry args={[0.09, 0.12, 0.9]} />
          <meshStandardMaterial color={POLY} metalness={0.3} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.05, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.032, 0.032, 0.7, 10]} />
          <meshStandardMaterial color={GUNMETAL} metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.04, -0.1]}>
          <boxGeometry args={[0.07, 0.07, 0.4]} />
          <meshStandardMaterial color={ACCENT} metalness={0.4} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.14, 0.18]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.07, 0.16, 0.1]} />
          <meshStandardMaterial color={POLY} roughness={0.8} />
        </mesh>
      </group>
    );

  // rifle
  return (
    <group>
      <mesh position={[0, 0, -0.2]}>
        <boxGeometry args={[0.08, 0.13, 0.95]} />
        <meshStandardMaterial color={GUNMETAL} metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.04, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.13, 0.0]}>
        <boxGeometry args={[0.06, 0.18, 0.12]} />
        <meshStandardMaterial color={POLY} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.1, -0.05]}>
        <boxGeometry args={[0.03, 0.05, 0.18]} />
        <meshStandardMaterial color={ACCENT} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.02, 0.18]}>
        <boxGeometry args={[0.07, 0.1, 0.28]} />
        <meshStandardMaterial color={POLY} roughness={0.8} />
      </mesh>
    </group>
  );
}
