import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LobbyEnvironment } from "./LobbyEnvironment";
import { Fighter, PALETTES } from "./Fighter";

const HAZE = "#5a7050"; // misty forest horizon

function Rig() {
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    s.camera.position.x = 0.5 + Math.sin(t * 0.22) * 0.45;
    s.camera.position.y = 1.35 + Math.sin(t * 0.4) * 0.05;
    s.camera.lookAt(0, 1.0, 0);
  });
  return null;
}

function Operator() {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (g.current) g.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.18) * 0.55;
  });
  return (
    <group ref={g}>
      <Fighter palette={PALETTES.operator} weapon="m4" position={[0, 0, 0]} />
    </group>
  );
}

export function LobbyScene() {
  return (
    <Canvas shadows camera={{ position: [0.5, 1.35, 4.7], fov: 42, near: 0.1, far: 160 }} dpr={[1, 2]}>
      <color attach="background" args={[HAZE]} />
      <fog attach="fog" args={[HAZE, 10, 55]} />

      {/* golden sun through the canopy + green sky fill + warm bounce */}
      <hemisphereLight args={["#b8d4b0", "#2E4A24", 0.85]} />
      <directionalLight position={[10, 16, 6]} intensity={1.6} color="#ffe3a8" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}>
        <orthographicCamera attach="shadow-camera" args={[-14, 14, 14, -14, 0.1, 60]} />
      </directionalLight>
      <directionalLight position={[-8, 4, -6]} intensity={0.4} color="#8a7a3f" />

      <LobbyEnvironment />
      <Operator />
      <Rig />
    </Canvas>
  );
}
