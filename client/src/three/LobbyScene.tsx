import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LobbyEnvironment } from "./LobbyEnvironment";
import { TacticalOperator } from "./TacticalOperator";

const SKY = "#5a626b"; // overcast grey

function Rig() {
  const cam = useRef<THREE.Camera>(null);
  // gentle camera drift for life (no DOF lib needed — fog gives depth)
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    s.camera.position.x = 0.6 + Math.sin(t * 0.25) * 0.35;
    s.camera.position.y = 1.32 + Math.sin(t * 0.4) * 0.04;
    s.camera.lookAt(0, 1.05, 0);
  });
  return <group ref={cam as any} />;
}

export function LobbyScene() {
  return (
    <Canvas shadows camera={{ position: [0.6, 1.32, 4.7], fov: 42, near: 0.1, far: 120 }} dpr={[1, 2]}>
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 7, 40]} />

      {/* overcast key + sky fill + warm rim for separation */}
      <hemisphereLight args={["#7a828c", "#1a1d20", 0.85]} />
      <directionalLight position={[8, 14, 6]} intensity={1.15} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}>
        <orthographicCamera attach="shadow-camera" args={[-12, 12, 12, -12, 0.1, 60]} />
      </directionalLight>
      <directionalLight position={[-6, 5, -8]} intensity={0.5} color="#c89b5a" />

      <LobbyEnvironment />
      <TacticalOperator position={[0, 0, 0]} />
      <Rig />
    </Canvas>
  );
}
