import { useEffect, useMemo, useRef } from "react";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { Grid, OrbitControls, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { useEditor } from "../lib/store";
import { getAsset } from "../lib/assets";
import { snapVec } from "../lib/geometry";
import { AssetMesh } from "./AssetMesh";
import type { Vec3 } from "../lib/types";

const LIGHT_PRESETS: Record<string, { sky: string; ground: string; sun: number; amb: number; fog: string }> = {
  warehouse: { sky: "#3a4250", ground: "#0c0e12", sun: 1.0, amb: 0.55, fog: "#0b0e13" },
  indoor: { sky: "#2b3038", ground: "#0a0c0f", sun: 0.7, amb: 0.6, fog: "#090b0e" },
  dusk: { sky: "#6b4a3a", ground: "#11100f", sun: 0.9, amb: 0.4, fog: "#1a120c" },
  night: { sky: "#1a2230", ground: "#070809", sun: 0.35, amb: 0.3, fog: "#05070a" },
};

function SceneLights({ preset }: { preset: string }) {
  const p = LIGHT_PRESETS[preset] || LIGHT_PRESETS.warehouse;
  return (
    <>
      <hemisphereLight args={[p.sky, p.ground, p.amb]} />
      <directionalLight position={[30, 50, 20]} intensity={p.sun} castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-60, 60, 60, -60, 0.1, 200]} />
      </directionalLight>
      <directionalLight position={[-20, 25, -15]} intensity={p.sun * 0.3} />
    </>
  );
}

function Editor() {
  const { map, selectedId, placing, transformMode, snap, snapSize, addObject, select, updateObject } = useEditor();
  const proxy = useMemo(() => new THREE.Object3D(), []);
  const orbitRef = useRef<any>(null);
  const tcRef = useRef<any>(null);
  const hoverRef = useRef<Vec3 | null>(null);
  const ghostRef = useRef<THREE.Group>(null);

  const selected = map?.objects.find((o) => o.id === selectedId) || null;

  // Ghost preview follows the cursor (hoverRef is mutated on pointer move).
  useFrame(() => {
    if (placing && ghostRef.current && hoverRef.current) {
      const def = getAsset(placing);
      const p = snap ? snapVec(hoverRef.current, snapSize) : hoverRef.current;
      ghostRef.current.position.set(p[0], p[1] + def.size[1] / 2, p[2]);
    }
  });

  // Sync the transform proxy whenever the selection changes.
  useEffect(() => {
    if (!selected) return;
    proxy.position.set(...selected.position);
    proxy.rotation.set(...(selected.rotation as [number, number, number]));
    proxy.scale.set(...selected.scale);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const place = (e: ThreeEvent<PointerEvent>) => {
    if (!placing) return;
    e.stopPropagation();
    const def = getAsset(placing);
    const y = e.point.y + def.size[1] / 2 + 0.001;
    addObject(placing, [e.point.x, y, e.point.z]);
  };

  const onObjectChange = () => {
    if (!selected) return;
    updateObject(
      selected.id,
      {
        position: [proxy.position.x, proxy.position.y, proxy.position.z],
        rotation: [proxy.rotation.x, proxy.rotation.y, proxy.rotation.z],
        scale: [
          Math.max(0.1, proxy.scale.x),
          Math.max(0.1, proxy.scale.y),
          Math.max(0.1, proxy.scale.z),
        ],
      },
      false
    );
  };

  const onDragChange = (dragging: boolean) => {
    if (orbitRef.current) orbitRef.current.enabled = !dragging;
    if (!dragging && selected && snap && transformMode === "translate") {
      const snapped = snapVec([proxy.position.x, proxy.position.y, proxy.position.z], snapSize);
      proxy.position.set(...snapped);
      updateObject(selected.id, { position: snapped }, true);
    } else if (!dragging && selected) {
      updateObject(selected.id, {}, true); // push a history checkpoint
    }
  };

  return (
    <>
      <color attach="background" args={["#0a0c0f"]} />
      <fog attach="fog" args={[(LIGHT_PRESETS[map?.lighting.preset || "warehouse"] || LIGHT_PRESETS.warehouse).fog, 60, 160]} />
      <SceneLights preset={map?.lighting.preset || "warehouse"} />

      <Grid
        args={[400, 400]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1b2027"
        sectionSize={8}
        sectionThickness={1}
        sectionColor="#2c3744"
        fadeDistance={140}
        fadeStrength={1.5}
        infiniteGrid
        position={[0, -0.01, 0]}
      />

      {/* Raycast catch-plane for placement */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onPointerDown={(e) => (placing ? place(e) : select(null))}
        onPointerMove={(e) => (hoverRef.current = [e.point.x, e.point.y, e.point.z])}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Placed objects */}
      {map?.objects.map((o) => (
        <group
          key={o.id}
          onPointerDown={(e) => {
            if (placing) {
              place(e);
            } else {
              e.stopPropagation();
              select(o.id);
            }
          }}
        >
          <AssetMesh object={o} selected={o.id === selectedId} />
        </group>
      ))}

      {/* Ghost preview while placing (group is moved each frame to follow cursor) */}
      {placing && (
        <group ref={ghostRef}>
          <AssetMesh object={{ id: "ghost", kind: placing, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }} ghost />
        </group>
      )}

      <primitive object={proxy} />
      {selected && (
        <TransformControls
          ref={tcRef}
          object={proxy}
          mode={transformMode}
          onObjectChange={onObjectChange}
          onMouseDown={() => onDragChange(true)}
          onMouseUp={() => onDragChange(false)}
        />
      )}

      <OrbitControls ref={orbitRef} makeDefault enableDamping dampingFactor={0.1} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

export function EditorScene() {
  return (
    <Canvas shadows camera={{ position: [22, 20, 22], fov: 50 }} dpr={[1, 2]}>
      <Editor />
    </Canvas>
  );
}
