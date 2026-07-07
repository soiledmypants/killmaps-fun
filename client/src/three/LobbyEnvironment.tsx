import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Original forest-battlefield environment (no ripped assets): grass clearing,
// pines and broadleaf trees, boulders, fallen logs, sandbag emplacements, a
// timber watchtower and drifting pollen motes in the golden light.
const GRASS = "#2E4A24";
const GRASS_DK = "#243B1C";
const DIRT = "#4A3B26";
const BARK = "#3D2E1F";
const BARK_LT = "#52402C";
const PINE = "#1F3D1B";
const PINE_LT = "#2C5226";
const LEAF = "#3E6B2E";
const LEAF_DK = "#325724";
const ROCK = "#6B7A5E";
const SANDBAG = "#7A6B4A";
const TIMBER = "#5C4630";

function Pine({ position, s = 1, lean = 0 }: { position: [number, number, number]; s?: number; lean?: number }) {
  return (
    <group position={position} rotation={[0, 0, lean]} scale={s}>
      <mesh castShadow position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.18, 0.28, 2.4, 7]} />
        <meshStandardMaterial color={BARK} roughness={1} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} castShadow position={[0, 2.2 + i * 1.15, 0]}>
          <coneGeometry args={[1.7 - i * 0.45, 1.7, 8]} />
          <meshStandardMaterial color={i % 2 ? PINE_LT : PINE} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function Oak({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  return (
    <group position={position} scale={s}>
      <mesh castShadow position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.22, 0.34, 2.8, 7]} />
        <meshStandardMaterial color={BARK_LT} roughness={1} />
      </mesh>
      {[[-0.6, 3.0, 0.2, 1.1], [0.7, 3.2, -0.3, 1.0], [0, 3.9, 0.1, 1.25], [0.1, 2.8, 0.7, 0.8]].map(([x, y, z, r], i) => (
        <mesh key={i} castShadow position={[x, y, z]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i % 2 ? LEAF : LEAF_DK} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Boulder({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  return (
    <mesh castShadow receiveShadow position={position} scale={[s, s * 0.75, s]} rotation={[0.2, 1.1, 0.1]}>
      <icosahedronGeometry args={[0.9, 0]} />
      <meshStandardMaterial color={ROCK} roughness={0.95} flatShading />
    </mesh>
  );
}

function FallenLog({ position, rotY = 0, len = 3 }: { position: [number, number, number]; rotY?: number; len?: number }) {
  return (
    <group position={position} rotation={[0, rotY, Math.PI / 2]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.42, len, 9]} />
        <meshStandardMaterial color={BARK} roughness={1} />
      </mesh>
      <mesh position={[0, len / 2 + 0.005, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.02, 9]} />
        <meshStandardMaterial color={TIMBER} roughness={1} />
      </mesh>
    </group>
  );
}

function Sandbags({ position, rotY = 0 }: { position: [number, number, number]; rotY?: number }) {
  const bag = (x: number, y: number, z: number) => (
    <mesh key={`${x}-${y}-${z}`} castShadow receiveShadow position={[x, y, z]}>
      <boxGeometry args={[0.9, 0.34, 0.5]} />
      <meshStandardMaterial color={SANDBAG} roughness={1} />
    </mesh>
  );
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {bag(-0.9, 0.17, 0)}
      {bag(0, 0.17, 0)}
      {bag(0.9, 0.17, 0)}
      {bag(-0.45, 0.51, 0)}
      {bag(0.45, 0.51, 0)}
      {bag(0, 0.85, 0)}
    </group>
  );
}

function Crate({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  return (
    <mesh castShadow receiveShadow position={position}>
      <boxGeometry args={[1.1 * s, 1.1 * s, 1.1 * s]} />
      <meshStandardMaterial color={TIMBER} roughness={0.92} />
    </mesh>
  );
}

function Watchtower({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 2, z]}>
          <boxGeometry args={[0.28, 4, 0.28]} />
          <meshStandardMaterial color={TIMBER} roughness={1} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 4.1, 0]}>
        <boxGeometry args={[3, 0.22, 3]} />
        <meshStandardMaterial color={BARK_LT} roughness={1} />
      </mesh>
      {[[0, 4.75, 1.4, 3, 0.9, 0.12], [0, 4.75, -1.4, 3, 0.9, 0.12], [1.4, 4.75, 0, 0.12, 0.9, 3], [-1.4, 4.75, 0, 0.12, 0.9, 3]].map(([x, y, z, w, h, d], i) => (
        <mesh key={"r" + i} castShadow position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={TIMBER} roughness={1} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 5.8, 0]}>
        <coneGeometry args={[2.4, 1.2, 4]} />
        <meshStandardMaterial color={PINE} roughness={1} flatShading />
      </mesh>
    </group>
  );
}

// Drifting pollen / dust motes in the golden light.
function PollenMotes() {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 140;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 5;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame((s, dt) => {
    if (!ref.current) return;
    const arr = (ref.current.geometry.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += dt * 0.4; // drift on the breeze
      arr[i + 1] += Math.sin(s.clock.elapsedTime + i) * dt * 0.06;
      if (arr[i] > 20) arr[i] = -20;
    }
    (ref.current.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#e8d9a0" size={0.05} transparent opacity={0.45} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export function LobbyEnvironment() {
  return (
    <group>
      {/* grass ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color={GRASS} roughness={1} />
      </mesh>
      {/* worn dirt patches */}
      {[[-3, 2], [4, -1], [0, 4]].map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]}>
          <circleGeometry args={[2.4 + i, 24]} />
          <meshStandardMaterial color={i === 1 ? DIRT : GRASS_DK} roughness={1} />
        </mesh>
      ))}

      {/* treeline */}
      <Pine position={[-9, 0, -12]} s={1.4} />
      <Pine position={[-13, 0, -8]} s={1.1} lean={0.04} />
      <Pine position={[9, 0, -13]} s={1.6} />
      <Pine position={[13, 0, -9]} s={1.2} lean={-0.05} />
      <Pine position={[-2, 0, -17]} s={1.5} />
      <Pine position={[4, 0, -16]} s={1.15} />
      <Pine position={[16, 0, -4]} s={1.3} />
      <Oak position={[-15, 0, -2]} s={1.2} />
      <Oak position={[-6.5, 0, -9]} s={1.0} />
      <Oak position={[7, 0, -7]} s={1.15} />
      <Oak position={[12, 0, -14]} s={0.9} />

      {/* watchtower on the flank */}
      <Watchtower position={[-10, 0, -5]} />

      {/* boulders + deadfall */}
      <Boulder position={[6, 0.5, 1.5]} s={1.2} />
      <Boulder position={[7.2, 0.35, 0.6]} s={0.8} />
      <Boulder position={[-7, 0.45, 2.5]} s={1.0} />
      <FallenLog position={[-3.6, 0.4, -1.6]} rotY={0.5} len={3.4} />
      <FallenLog position={[5, 0.4, -4]} rotY={-0.9} len={2.6} />

      {/* forward emplacement near the operator */}
      <Sandbags position={[3.4, 0, -1.4]} rotY={0.4} />
      <Crate position={[4.5, 0.55, -2.6]} />
      <Crate position={[4.0, 1.55, -2.2]} s={0.85} />
      <Sandbags position={[-4.6, 0, -0.6]} rotY={-0.5} />

      <PollenMotes />
    </group>
  );
}
