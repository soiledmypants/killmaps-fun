import { useEffect, useMemo, useRef } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { useEditor } from "../lib/store";
import { getAsset } from "../lib/assets";
import { snapVec } from "../lib/geometry";
import { AssetMesh } from "./AssetMesh";
import type { Vec3 } from "../lib/types";

// Forest battlefield lighting: warm golden ambient, dappled daylight, green haze.
const PRESETS: Record<string, { sky: string; ground: string; sun: number; amb: number; fog: string; sunColor: string }> = {
  forest: { sky: "#b8d4b0", ground: "#2E4425", sun: 1.4, amb: 0.8, fog: "#5a7050", sunColor: "#ffe3a8" },
  dusk: { sky: "#c99b6a", ground: "#22301C", sun: 1.0, amb: 0.5, fog: "#5c503a", sunColor: "#ffc890" },
  night: { sky: "#20301F", ground: "#0A1F0A", sun: 0.4, amb: 0.35, fog: "#101B10", sunColor: "#a8c0a0" },
  indoor: { sky: "#a8a890", ground: "#1E160E", sun: 0.8, amb: 0.7, fog: "#171208", sunColor: "#ffe3a8" },
  warehouse: { sky: "#a8a890", ground: "#1E160E", sun: 1.0, amb: 0.6, fog: "#1E160E", sunColor: "#ffe0a0" },
};
PRESETS.desert = PRESETS.forest; // legacy preset id from older maps

function SceneLights({ preset }: { preset: string }) {
  const p = PRESETS[preset] || PRESETS.forest;
  return (
    <>
      <hemisphereLight args={[p.sky, p.ground, p.amb]} />
      <directionalLight position={[30, 50, 20]} intensity={p.sun} color={p.sunColor} castShadow shadow-mapSize={[2048, 2048]}>
        <orthographicCamera attach="shadow-camera" args={[-60, 60, 60, -60, 0.1, 200]} />
      </directionalLight>
      <directionalLight position={[-20, 25, -15]} intensity={p.sun * 0.3} color="#8a7a3f" />
    </>
  );
}

function Editor() {
  const { map, selectedId, placing, transformMode, snap, snapSize, rotSnap, scaleSnap, addObject, select, updateObject } = useEditor();
  const { camera } = useThree();
  const proxy = useMemo(() => new THREE.Object3D(), []);
  const orbit = useRef<any>(null);
  const hoverRef = useRef<Vec3 | null>(null);
  const ghostRef = useRef<THREE.Group>(null);
  const keys = useRef<Record<string, boolean>>({});
  const speed = useRef(14);
  const gizmoDrag = useRef(false);

  const selected = map?.objects.find((o) => o.id === selectedId) || null;
  const preset = map?.lighting.preset || "forest";

  // Sync the gizmo proxy when the selection changes.
  useEffect(() => {
    if (!selected) return;
    proxy.position.set(...selected.position);
    proxy.rotation.set(...(selected.rotation as [number, number, number]));
    proxy.scale.set(...selected.scale);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly controls: WASD move, Q/E down/up, Shift faster, F focus selected.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      keys.current[e.code] = true;
      if (e.code === "KeyF" && selected) {
        const t = new THREE.Vector3(...selected.position);
        if (orbit.current) orbit.current.target.copy(t);
        camera.position.copy(t).add(new THREE.Vector3(7, 6, 7));
      }
    };
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [selected, camera]);

  useFrame((_s, dt) => {
    // ghost follows cursor
    if (placing && ghostRef.current && hoverRef.current) {
      const def = getAsset(placing);
      const pp = snap ? snapVec(hoverRef.current, snapSize) : hoverRef.current;
      ghostRef.current.position.set(pp[0], pp[1] + def.size[1] / 2, pp[2]);
    }
    // WASD fly (moves camera + orbit target together)
    const k = keys.current;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const mv = new THREE.Vector3();
    if (k["KeyW"]) mv.add(fwd);
    if (k["KeyS"]) mv.sub(fwd);
    if (k["KeyD"]) mv.add(right);
    if (k["KeyA"]) mv.sub(right);
    if (k["KeyE"]) mv.y += 1;
    if (k["KeyQ"]) mv.y -= 1;
    if (mv.lengthSq() > 0) {
      mv.normalize().multiplyScalar(speed.current * dt * (k["ShiftLeft"] || k["ShiftRight"] ? 3 : 1));
      camera.position.add(mv);
      if (orbit.current) orbit.current.target.add(mv);
    }
  });

  const placeAt = (point: Vec3) => {
    if (!placing) return;
    const def = getAsset(placing);
    const xz = snap ? snapVec([point[0], 0, point[2]], snapSize) : [point[0], 0, point[2]];
    addObject(placing, [xz[0], point[1] + def.size[1] / 2 + 0.001, xz[2]]);
  };

  const onObjectClick = (e: ThreeEvent<MouseEvent>, id: string) => {
    if (gizmoDrag.current) return;
    e.stopPropagation();
    if (placing) {
      // place on top face, else on the floor under the cursor
      let y = 0;
      const n = e.face?.normal?.clone().transformDirection(e.object.matrixWorld);
      if (n && n.y > 0.5) y = e.point.y;
      placeAt([e.point.x, y, e.point.z]);
    } else {
      select(id);
    }
  };

  return (
    <>
      <color attach="background" args={[(PRESETS[preset] || PRESETS.forest).fog]} />
      <fog attach="fog" args={[(PRESETS[preset] || PRESETS.forest).fog, 70, 180]} />
      <SceneLights preset={preset} />

      <Grid
        args={[400, 400]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1A3A2A"
        sectionSize={8}
        sectionThickness={1}
        sectionColor="#38583C"
        fadeDistance={150}
        fadeStrength={1.5}
        infiniteGrid
        position={[0, -0.01, 0]}
      />

      {/* ground catch-plane: left-click places (when a tool is armed) or deselects */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          if (gizmoDrag.current) return;
          if (placing) placeAt([e.point.x, 0, e.point.z]);
          else select(null);
        }}
        onPointerMove={(e) => (hoverRef.current = [e.point.x, 0, e.point.z])}
      >
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {map?.objects.map((o) => (
        <group key={o.id} onClick={(e) => onObjectClick(e, o.id)}>
          <AssetMesh object={o} selected={o.id === selectedId} />
        </group>
      ))}

      {placing && (
        <group ref={ghostRef}>
          <AssetMesh object={{ id: "ghost", kind: placing, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }} ghost />
        </group>
      )}

      <primitive object={proxy} />
      {selected && (
        <TransformControls
          object={proxy}
          mode={transformMode}
          rotationSnap={rotSnap ? Math.PI / 12 : null}
          scaleSnap={scaleSnap ? 0.25 : null}
          translationSnap={snap ? snapSize : null}
          onObjectChange={() => {
            updateObject(
              selected.id,
              {
                position: [proxy.position.x, proxy.position.y, proxy.position.z],
                rotation: [proxy.rotation.x, proxy.rotation.y, proxy.rotation.z],
                scale: [Math.max(0.1, proxy.scale.x), Math.max(0.1, proxy.scale.y), Math.max(0.1, proxy.scale.z)],
              },
              false
            );
          }}
          onMouseDown={() => {
            gizmoDrag.current = true;
            if (orbit.current) orbit.current.enabled = false;
          }}
          onMouseUp={() => {
            if (orbit.current) orbit.current.enabled = true;
            updateObject(selected.id, {}, true); // history checkpoint
            setTimeout(() => (gizmoDrag.current = false), 0);
          }}
        />
      )}

      {/* Camera: LEFT disabled (free for placing/selecting), RIGHT look, MIDDLE pan, wheel zoom */}
      <OrbitControls
        ref={orbit}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        maxPolarAngle={Math.PI / 2.05}
        mouseButtons={{ LEFT: null as any, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }}
      />
    </>
  );
}

export function EditorScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [22, 20, 22], fov: 50 }}
      dpr={[1, 2]}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Editor />
    </Canvas>
  );
}
