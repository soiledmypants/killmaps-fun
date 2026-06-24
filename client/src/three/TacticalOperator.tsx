import { useRef } from "react";
import { useFrame, GroupProps } from "@react-three/fiber";
import * as THREE from "three";
import { RifleModel } from "./RifleModel";

// Original low-poly tactical operator — no copyrighted/ripped models. Built from
// primitives: head, helmet, visor/mask, torso, plate-carrier vest + pouches, arms,
// gloves, legs, boots, with a rifle held across the chest and a subtle idle breathe.
const FATIGUE = "#4b5249";
const FATIGUE_DK = "#3a4039";
const VEST = "#1e2125";
const VEST_AC = "#2b3036";
const GLOVE = "#141719";
const BOOT = "#0e1114";
const HELMET = "#2b3036";
const VISOR = "#0a0c0e";
const STRAP = "#7c6f50";

function Leg({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      {/* thigh */}
      <mesh castShadow position={[0, 0.74, 0]}>
        <boxGeometry args={[0.17, 0.44, 0.19]} />
        <meshStandardMaterial color={FATIGUE} roughness={0.85} />
      </mesh>
      {/* knee pad */}
      <mesh castShadow position={[0, 0.52, 0.07]}>
        <boxGeometry args={[0.16, 0.1, 0.08]} />
        <meshStandardMaterial color={VEST_AC} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* shin */}
      <mesh castShadow position={[0, 0.32, 0]}>
        <boxGeometry args={[0.15, 0.42, 0.17]} />
        <meshStandardMaterial color={FATIGUE_DK} roughness={0.85} />
      </mesh>
      {/* boot */}
      <mesh castShadow position={[0, 0.07, 0.05]}>
        <boxGeometry args={[0.17, 0.14, 0.3]} />
        <meshStandardMaterial color={BOOT} roughness={0.6} metalness={0.1} />
      </mesh>
    </group>
  );
}

function Arm({ side }: { side: 1 | -1 }) {
  // side=1 -> operator's left (screen left). Both forearms converge on the rifle.
  return (
    <group position={[0.27 * side, 1.46, 0.02]}>
      {/* shoulder pad */}
      <mesh castShadow>
        <boxGeometry args={[0.16, 0.16, 0.2]} />
        <meshStandardMaterial color={VEST} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* upper arm angled down+forward */}
      <mesh castShadow position={[0.01 * side, -0.18, 0.07]} rotation={[0.5, 0, 0.15 * side]}>
        <boxGeometry args={[0.12, 0.3, 0.13]} />
        <meshStandardMaterial color={FATIGUE} roughness={0.85} />
      </mesh>
      {/* forearm reaching inward to the weapon */}
      <mesh castShadow position={[-0.06 * side, -0.32, 0.24]} rotation={[1.15, 0, 0.55 * side]}>
        <boxGeometry args={[0.11, 0.3, 0.12]} />
        <meshStandardMaterial color={FATIGUE_DK} roughness={0.85} />
      </mesh>
      {/* glove on the weapon */}
      <mesh castShadow position={[-0.12 * side, -0.42, 0.34]}>
        <boxGeometry args={[0.1, 0.11, 0.13]} />
        <meshStandardMaterial color={GLOVE} roughness={0.9} />
      </mesh>
    </group>
  );
}

export function TacticalOperator({ withRifle = true, ...props }: GroupProps & { withRifle?: boolean }) {
  const upper = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (upper.current) {
      upper.current.position.y = Math.sin(t * 1.6) * 0.013; // breathing
      upper.current.rotation.z = Math.sin(t * 0.7) * 0.012; // sway
    }
    if (head.current) head.current.rotation.y = Math.sin(t * 0.45) * 0.12; // scanning
  });

  return (
    <group {...props}>
      <Leg x={-0.13} />
      <Leg x={0.13} />
      {/* pelvis / belt */}
      <mesh castShadow position={[0, 1.0, 0]}>
        <boxGeometry args={[0.38, 0.2, 0.23]} />
        <meshStandardMaterial color={FATIGUE_DK} roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0, 0.95, 0.02]}>
        <boxGeometry args={[0.4, 0.06, 0.25]} />
        <meshStandardMaterial color={STRAP} roughness={0.7} />
      </mesh>

      {/* breathing upper body */}
      <group ref={upper} position={[0, 1.27, 0]}>
        {/* torso */}
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.5, 0.24]} />
          <meshStandardMaterial color={FATIGUE} roughness={0.85} />
        </mesh>
        {/* plate carrier vest */}
        <mesh castShadow position={[0, 0.02, 0.02]}>
          <boxGeometry args={[0.46, 0.44, 0.29]} />
          <meshStandardMaterial color={VEST} roughness={0.6} metalness={0.25} />
        </mesh>
        {/* chest pouches */}
        {[-0.12, 0.12].map((x) => (
          <mesh key={x} castShadow position={[x, -0.04, 0.17]}>
            <boxGeometry args={[0.14, 0.16, 0.08]} />
            <meshStandardMaterial color={VEST_AC} roughness={0.7} metalness={0.2} />
          </mesh>
        ))}
        {/* shoulder straps */}
        {[-0.13, 0.13].map((x) => (
          <mesh key={x} castShadow position={[x, 0.24, 0.08]}>
            <boxGeometry args={[0.08, 0.16, 0.18]} />
            <meshStandardMaterial color={STRAP} roughness={0.7} />
          </mesh>
        ))}

        {/* neck */}
        <mesh castShadow position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.1, 8]} />
          <meshStandardMaterial color={GLOVE} roughness={0.8} />
        </mesh>

        {/* head + helmet + visor */}
        <group ref={head} position={[0, 0.52, 0]}>
          {/* balaclava head */}
          <mesh castShadow>
            <boxGeometry args={[0.22, 0.26, 0.24]} />
            <meshStandardMaterial color={GLOVE} roughness={0.85} />
          </mesh>
          {/* helmet */}
          <mesh castShadow position={[0, 0.1, 0]}>
            <boxGeometry args={[0.26, 0.16, 0.28]} />
            <meshStandardMaterial color={HELMET} roughness={0.55} metalness={0.3} />
          </mesh>
          <mesh castShadow position={[0, 0.05, 0.12]}>
            <boxGeometry args={[0.27, 0.06, 0.06]} />
            <meshStandardMaterial color={HELMET} roughness={0.55} metalness={0.3} />
          </mesh>
          {/* visor / eye band */}
          <mesh position={[0, 0.0, 0.12]}>
            <boxGeometry args={[0.2, 0.07, 0.06]} />
            <meshStandardMaterial color={VISOR} roughness={0.3} metalness={0.5} emissive="#0a1418" emissiveIntensity={0.4} />
          </mesh>
        </group>

        {/* arms + weapon */}
        <group position={[0, 0.05, 0]}>
          <Arm side={1} />
          <Arm side={-1} />
          {withRifle && <RifleModel position={[0, -0.08, 0.34]} rotation={[0.05, Math.PI / 2, -0.12]} scale={0.92} />}
        </group>
      </group>
    </group>
  );
}
