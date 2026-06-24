import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Original desert-compound environment (Dust-2-style atmosphere, no ripped assets):
// sand yard, adobe buildings, arched market alley, palm trees, crates, barrels,
// stone walls and drifting dust motes.
const SAND = "#c2a878";
const SAND_DK = "#a98f5f";
const ADOBE = "#cbb286";
const ADOBE_DK = "#a98a5e";
const ADOBE_SH = "#8f7350";
const STONE = "#b3a892";
const WOOD = "#9c7444";
const PALM = "#6e5638";
const FROND = "#5f7a39";
const FROND_DK = "#4d6730";

function Adobe({ position, w = 4, h = 3.5, d = 4, color = ADOBE, arch = false }: { position: [number, number, number]; w?: number; h?: number; d?: number; color?: string; arch?: boolean }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {/* parapet */}
      <mesh castShadow position={[0, h + 0.12, 0]}>
        <boxGeometry args={[w + 0.2, 0.24, d + 0.2]} />
        <meshStandardMaterial color={ADOBE_DK} roughness={0.95} />
      </mesh>
      {/* recessed windows */}
      {[-w / 4, w / 4].map((x) => (
        <mesh key={x} position={[x, h * 0.6, d / 2 + 0.02]}>
          <boxGeometry args={[w * 0.16, h * 0.22, 0.12]} />
          <meshStandardMaterial color={ADOBE_SH} roughness={1} />
        </mesh>
      ))}
      {/* doorway / arch */}
      {arch && (
        <mesh position={[0, h * 0.28, d / 2 + 0.03]}>
          <boxGeometry args={[w * 0.26, h * 0.5, 0.14]} />
          <meshStandardMaterial color="#3a2c1c" roughness={1} />
        </mesh>
      )}
    </group>
  );
}

function MarketArch({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} castShadow position={[x, 1.4, 0]}>
          <boxGeometry args={[0.5, 2.8, 0.5]} />
          <meshStandardMaterial color={ADOBE} roughness={0.95} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 2.9, 0]}>
        <boxGeometry args={[3.6, 0.5, 0.6]} />
        <meshStandardMaterial color={ADOBE_DK} roughness={0.95} />
      </mesh>
      {/* awning */}
      <mesh castShadow position={[0, 2.55, 0.7]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[3.2, 0.06, 1.2]} />
        <meshStandardMaterial color="#9c4a3a" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Palm({ position, lean = 0.1, s = 1 }: { position: [number, number, number]; lean?: number; s?: number }) {
  const fronds = 8;
  return (
    <group position={position} rotation={[0, 0, lean]} scale={s}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} castShadow position={[i * 0.06, 0.5 + i * 0.9, 0]} rotation={[0, 0, -0.04 * i]}>
          <cylinderGeometry args={[0.16 - i * 0.02, 0.2 - i * 0.02, 0.95, 7]} />
          <meshStandardMaterial color={PALM} roughness={1} />
        </mesh>
      ))}
      <group position={[0.2, 4.0, 0]}>
        {Array.from({ length: fronds }).map((_, i) => {
          const a = (i / fronds) * Math.PI * 2;
          return (
            <mesh key={i} castShadow position={[Math.cos(a) * 0.7, -0.1, Math.sin(a) * 0.7]} rotation={[Math.sin(a) * 0.5, -a, 0.5]}>
              <boxGeometry args={[1.6, 0.06, 0.34]} />
              <meshStandardMaterial color={i % 2 ? FROND : FROND_DK} roughness={0.85} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function Barrel({ position, color = "#7a5236" }: { position: [number, number, number]; color?: string }) {
  return (
    <mesh castShadow receiveShadow position={position}>
      <cylinderGeometry args={[0.42, 0.42, 1.2, 14]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
    </mesh>
  );
}

function Crate({ position, s = 1 }: { position: [number, number, number]; s?: number }) {
  return (
    <mesh castShadow receiveShadow position={position}>
      <boxGeometry args={[1.1 * s, 1.1 * s, 1.1 * s]} />
      <meshStandardMaterial color={WOOD} roughness={0.92} />
    </mesh>
  );
}

function DustMotes() {
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
      arr[i] += dt * 0.6; // drift on wind
      arr[i + 1] += Math.sin(s.clock.elapsedTime + i) * dt * 0.05;
      if (arr[i] > 20) arr[i] = -20;
    }
    (ref.current.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial color="#e7d8b4" size={0.06} transparent opacity={0.5} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export function LobbyEnvironment() {
  return (
    <group>
      {/* sand ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color={SAND} roughness={1} />
      </mesh>
      {/* worn sand patches */}
      {[[-3, 2], [4, -1], [0, 4]].map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]}>
          <circleGeometry args={[2.4 + i, 24]} />
          <meshStandardMaterial color={SAND_DK} roughness={1} />
        </mesh>
      ))}

      {/* compound buildings */}
      <Adobe position={[-9, 0, -12]} w={7} h={5} d={6} color={ADOBE} arch />
      <Adobe position={[9, 0, -13]} w={8} h={6.5} d={7} color={ADOBE_DK} />
      <Adobe position={[-2, 0, -17]} w={6} h={4} d={5} color={ADOBE} />
      <Adobe position={[15, 0, -6]} w={5} h={4.5} d={6} color={ADOBE_DK} arch />

      {/* market alley */}
      <MarketArch position={[-6, 0, -3]} />
      <Adobe position={[-10, 0, -2]} w={3.5} h={3} d={4} color={ADOBE} arch />

      {/* low stone perimeter wall */}
      {[-14, -7, 7, 14].map((x) => (
        <mesh key={x} castShadow receiveShadow position={[x, 0.6, 6]}>
          <boxGeometry args={[6, 1.2, 0.6]} />
          <meshStandardMaterial color={STONE} roughness={0.95} />
        </mesh>
      ))}

      {/* palms */}
      <Palm position={[-6.5, 0, 1.5]} lean={0.08} s={1.05} />
      <Palm position={[7, 0, -2]} lean={-0.1} s={0.95} />
      <Palm position={[12, 0, -10]} lean={0.05} s={1.1} />

      {/* crates + barrels near the operator */}
      <Crate position={[3.4, 0.55, -1.4]} />
      <Crate position={[4.3, 0.55, -2.3]} />
      <Crate position={[3.9, 1.55, -1.9]} s={0.9} />
      <Barrel position={[-3.6, 0.6, -1.6]} />
      <Barrel position={[-4.3, 0.6, -2.6]} color="#3f5560" />
      <Crate position={[-4.4, 0.55, -1.0]} s={1.1} />

      <DustMotes />
    </group>
  );
}
