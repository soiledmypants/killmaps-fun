import { GroupProps } from "@react-three/fiber";
import { WEAPONS, type WeaponId } from "../lib/fps";

// Original weapon models from primitives (no ripped/branded assets). Barrel points
// down -Z. Distinct silhouette per category. Reused for viewmodels + third-person.
const METAL = "#23282d";
const METAL_D = "#15181b";
const POLY = "#101316";
const RAIL = "#333b43";
const WOOD = "#5c4327";

function Assault({ ak }: { ak?: boolean }) {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.085, 0.13, 0.6]} />
        <meshStandardMaterial color={METAL} metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 0.0, -0.42]}>
        <boxGeometry args={[0.07, 0.1, 0.34]} />
        <meshStandardMaterial color={ak ? WOOD : POLY} metalness={ak ? 0.1 : 0.3} roughness={ak ? 0.8 : 0.6} />
      </mesh>
      <mesh castShadow position={[0, 0.03, -0.72]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.017, 0.017, 0.42, 10]} />
        <meshStandardMaterial color={METAL_D} metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0.12, 0.0]}>
        <boxGeometry args={[0.035, 0.05, 0.14]} />
        <meshStandardMaterial color={RAIL} metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, -0.17, -0.04]} rotation={[ak ? -0.35 : -0.15, 0, 0]}>
        <boxGeometry args={[0.06, 0.24, 0.1]} />
        <meshStandardMaterial color={POLY} metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, -0.13, 0.16]} rotation={[0.45, 0, 0]}>
        <boxGeometry args={[0.05, 0.15, 0.07]} />
        <meshStandardMaterial color={ak ? WOOD : POLY} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, -0.02, 0.42]}>
        <boxGeometry args={[0.055, 0.12, 0.26]} />
        <meshStandardMaterial color={ak ? WOOD : POLY} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Smg() {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.07, 0.12, 0.4]} />
        <meshStandardMaterial color={METAL} metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 0.02, -0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.2, 10]} />
        <meshStandardMaterial color={METAL_D} metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[0, -0.16, 0.02]} rotation={[-0.05, 0, 0]}>
        <boxGeometry args={[0.05, 0.22, 0.08]} />
        <meshStandardMaterial color={POLY} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, -0.11, 0.12]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.05, 0.13, 0.06]} />
        <meshStandardMaterial color={POLY} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.0, 0.26]}>
        <boxGeometry args={[0.04, 0.08, 0.16]} />
        <meshStandardMaterial color={METAL_D} metalness={0.6} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Pistol({ big }: { big?: boolean }) {
  const s = big ? 1.25 : 1;
  return (
    <group scale={s}>
      <mesh castShadow position={[0, 0.02, -0.04]}>
        <boxGeometry args={[0.05, 0.09, 0.32]} />
        <meshStandardMaterial color={big ? "#3a2f22" : METAL} metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[0, -0.15, 0.06]} rotation={[0.32, 0, 0]}>
        <boxGeometry args={[0.055, 0.2, 0.09]} />
        <meshStandardMaterial color={POLY} roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 0.03, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.1, 8]} />
        <meshStandardMaterial color={METAL_D} metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Shotgun() {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.09, 0.12, 0.85]} />
        <meshStandardMaterial color={POLY} metalness={0.3} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.05, -0.42]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.62, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[0, -0.04, -0.1]}>
        <boxGeometry args={[0.07, 0.07, 0.36]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, -0.14, 0.2]} rotation={[0.42, 0, 0]}>
        <boxGeometry args={[0.06, 0.15, 0.09]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
    </group>
  );
}

function Sniper() {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.08, 0.12, 0.8]} />
        <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.04, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.6, 10]} />
        <meshStandardMaterial color={METAL_D} metalness={0.9} roughness={0.3} />
      </mesh>
      {/* scope */}
      <mesh castShadow position={[0, 0.16, 0.0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.26, 12]} />
        <meshStandardMaterial color={METAL_D} metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.16, 0.14]}>
        <circleGeometry args={[0.028, 16]} />
        <meshStandardMaterial color="#0a1a22" emissive="#0a2a33" emissiveIntensity={0.6} />
      </mesh>
      <mesh castShadow position={[0, -0.14, 0.12]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.05, 0.15, 0.07]} />
        <meshStandardMaterial color={POLY} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, -0.02, 0.44]}>
        <boxGeometry args={[0.055, 0.14, 0.3]} />
        <meshStandardMaterial color={POLY} roughness={0.8} />
      </mesh>
    </group>
  );
}

export function WeaponModel({ weaponId, ...props }: GroupProps & { weaponId: WeaponId }) {
  const def = WEAPONS[weaponId] || WEAPONS.m4;
  let body;
  switch (def.category) {
    case "assault":
      body = <Assault ak={weaponId === "ak"} />;
      break;
    case "smg":
      body = <Smg />;
      break;
    case "pistol":
      body = <Pistol big={weaponId === "deagle"} />;
      break;
    case "shotgun":
      body = <Shotgun />;
      break;
    case "sniper":
      body = <Sniper />;
      break;
    default:
      body = <Assault />;
  }
  return <group {...props}>{body}</group>;
}
