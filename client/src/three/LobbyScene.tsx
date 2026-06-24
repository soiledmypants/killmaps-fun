import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LobbyEnvironment } from "./LobbyEnvironment";
import { Fighter, PALETTES } from "./Fighter";

const HAZE = "#cdb78d"; // dusty desert horizon

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

      {/* bright desert sun + sky fill + warm bounce */}
      <hemisphereLight args={["#cfe0e8", "#7a6238", 0.9]} />
      <directionalLight position={[10, 16, 6]} intensity={1.7} color="#ffe9c2" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}>
        <orthographicCamera attach="shadow-camera" args={[-14, 14, 14, -14, 0.1, 60]} />
      </directionalLight>
      <directionalLight position={[-8, 4, -6]} intensity={0.4} color="#b9893f" />

      <LobbyEnvironment />
      <Operator />
      <Rig />
    </Canvas>
  );
}
