import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { Fighter, PALETTES } from "../three/Fighter";
import { WeaponModel } from "../three/WeaponModel";
import { WEAPONS, ALL_WEAPONS, type WeaponId, type WeaponCategory } from "../lib/fps";
import { sound } from "../lib/sound";
import { Shield, Target, Lock } from "../components/icons";

// ---- viewer framing + camera defaults -------------------------------------
// Target sits at the operator's upper torso so the model rides a touch low in the
// frame with comfortable headroom; the camera is pulled back so the weapon never clips.
const TARGET: [number, number, number] = [0, 1.05, 0];
const AZ0 = 0.5; // default 3/4 azimuth (radians)
const POL0 = 1.45; // polar angle from +Y (~83°, near eye level)
const RAD0 = 4.9; // default distance
const POL_MIN = 1.15; // ~66° — limited upward tilt
const POL_MAX = 1.62; // ~93° — limited downward tilt (stays above the floor)
const RAD_MIN = 3.0; // min zoom keeps the camera outside the model (no clipping)
const RAD_MAX = 7.5; // max zoom
const TWO_PI = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Orbit { az: number; pol: number; rad: number }
const sphPos = (o: Orbit): [number, number, number] => [
  TARGET[0] + o.rad * Math.sin(o.pol) * Math.sin(o.az),
  TARGET[1] + o.rad * Math.cos(o.pol),
  TARGET[2] + o.rad * Math.sin(o.pol) * Math.cos(o.az),
];

// Drives the camera imperatively from a mutable `controls` ref (the drag/zoom target)
// with exponential damping toward it — so dragging never triggers a React render.
function CameraRig({ controls }: { controls: React.MutableRefObject<Orbit> }) {
  const { camera, gl } = useThree();
  const cur = useRef<Orbit>({ ...controls.current });

  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "none"; // drag rotates instead of scrolling on touch
    el.style.cursor = "grab";
    let dragging = false;
    let mode: "rotate" | "tilt" = "rotate";
    let lx = 0, ly = 0, pid = -1;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      pid = e.pointerId;
      mode = e.button === 2 || e.shiftKey ? "tilt" : "rotate";
      lx = e.clientX; ly = e.clientY;
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      const c = controls.current;
      if (mode === "rotate") c.az -= dx * 0.01; // continuous, unclamped → full 360°
      else c.pol = clamp(c.pol - dy * 0.006, POL_MIN, POL_MAX); // slight up/down tilt
    };
    const onUp = () => {
      dragging = false;
      if (pid >= 0 && el.hasPointerCapture?.(pid)) el.releasePointerCapture(pid);
      pid = -1;
      el.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = controls.current;
      c.rad = clamp(c.rad + e.deltaY * 0.0024, RAD_MIN, RAD_MAX);
    };
    const onDbl = () => {
      const c = controls.current;
      // reset via the shortest path so a multi-turn spin doesn't unwind on screen
      const delta = (((AZ0 - cur.current.az + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI - Math.PI;
      c.az = cur.current.az + delta;
      c.pol = POL0;
      c.rad = RAD0;
    };
    const onCtx = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDbl);
    el.addEventListener("contextmenu", onCtx);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDbl);
      el.removeEventListener("contextmenu", onCtx);
    };
  }, [gl, controls]);

  useFrame((_, dt) => {
    const c = controls.current;
    const k = 1 - Math.exp(-dt * 9); // frame-rate-independent damping (inertia)
    cur.current.az += (c.az - cur.current.az) * k;
    cur.current.pol += (c.pol - cur.current.pol) * k;
    cur.current.rad += (c.rad - cur.current.rad) * k;
    const [x, y, z] = sphPos(cur.current);
    camera.position.set(x, y, z);
    camera.lookAt(TARGET[0], TARGET[1], TARGET[2]); // target fixed → stays centered
  });

  return null;
}

// Swaps the held weapon with a quick lower-then-raise dip instead of popping. Only this
// small subtree re-renders (at the bottom of the dip), never the whole page.
function SwapWeapon({ weaponId }: { weaponId: WeaponId }) {
  const grp = useRef<THREE.Group>(null);
  const [shown, setShown] = useState<WeaponId>(weaponId);
  const target = useRef<WeaponId>(weaponId);
  const k = useRef(1); // 0 = lowered/hidden, 1 = fully raised
  const phase = useRef<0 | 1 | 2>(0); // 0 idle · 1 lowering · 2 raising

  useEffect(() => {
    if (weaponId !== target.current) { target.current = weaponId; phase.current = 1; }
  }, [weaponId]);

  useFrame((_, dt) => {
    const step = dt * 7;
    if (phase.current === 1) {
      k.current -= step;
      if (k.current <= 0) { k.current = 0; setShown(target.current); phase.current = 2; }
    } else if (phase.current === 2) {
      k.current += step;
      if (k.current >= 1) { k.current = 1; phase.current = 0; }
    }
    const g = grp.current;
    if (g) {
      const e = k.current; // 0 lowered .. 1 raised
      g.position.y = -0.16 * (1 - e);
      g.position.z = -0.05 * (1 - e);
      g.rotation.x = -0.6 * (1 - e);
      g.scale.setScalar(0.82 + 0.18 * e);
    }
  });

  return (
    <group ref={grp}>
      <WeaponModel weaponId={shown} />
    </group>
  );
}

// Subtle key spotlight aimed at the operator (target object kept in-scene so it tracks).
function Spotlight() {
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 1.0, 0);
    return o;
  }, []);
  return (
    <>
      <primitive object={target} />
      <spotLight position={[2.4, 5.4, 3.2]} target={target} angle={0.5} penumbra={0.85} intensity={2.8} distance={24} color="#ffe3a8" />
    </>
  );
}

function Pedestal() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <circleGeometry args={[1.3, 64]} />
        <meshStandardMaterial color="#123020" roughness={1} metalness={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.18, 1.3, 64]} />
        <meshBasicMaterial color="#D4A017" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function OperatorPreview({ weapon }: { weapon: WeaponId }) {
  // Lives in a ref so drag/zoom mutate it without re-rendering React.
  const controls = useRef<Orbit>({ az: AZ0, pol: POL0, rad: RAD0 });
  return (
    <Canvas
      camera={{ position: sphPos(controls.current), fov: 35, near: 0.1, far: 100 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ touchAction: "none", cursor: "grab" }}
    >
      <color attach="background" args={["#0D2818"]} />
      <fog attach="fog" args={["#0D2818", 7, 18]} />

      {/* brighter-but-still-dark lighting so weapon finishes read clearly */}
      <hemisphereLight args={["#b8d4b0", "#14301F", 0.95]} />
      <directionalLight position={[-4, 3, 4]} intensity={0.55} color="#a8c0a0" />
      <Spotlight />

      <Fighter palette={PALETTES.operator} weaponNode={<SwapWeapon weaponId={weapon} />} position={[0, 0, 0]} />
      <Pedestal />
      <ContactShadows position={[0, 0.012, 0]} opacity={0.55} scale={6} blur={3} far={3.5} resolution={256} color="#000000" />

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#1A3A2A" roughness={1} />
      </mesh>

      <CameraRig controls={controls} />
    </Canvas>
  );
}

const CATEGORY_LABEL: Record<WeaponCategory, string> = {
  assault: "Assault Rifle",
  smg: "SMG",
  pistol: "Pistol",
  shotgun: "Shotgun",
  sniper: "Sniper",
};

export default function Loadout() {
  const [active, setActive] = useState<WeaponId>("m4");
  const w = WEAPONS[active];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield size={22} className="text-accent" /> Loadout
          </h1>
          <p className="text-steel text-sm mt-1">Operator and weapon kit. Map creators choose which weapons are allowed in their arena.</p>
        </div>
        <span className="chip border-accent/40 bg-accent/10 text-accent">Preview</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <div className="panel relative overflow-hidden h-[520px]">
          <OperatorPreview weapon={active} />
          <div className="absolute bottom-3 left-3 panel px-3 py-2 bg-base-800/80 pointer-events-none">
            <div className="label">Operator</div>
            <div className="font-bold text-white">Vanguard-01</div>
            <div className="text-[11px] text-steel">Forest tactical operator</div>
          </div>
          <div className="absolute top-3 right-3 chip border-base-500 text-steel bg-base-800/80 pointer-events-none">Holding {w.name}</div>
          <div className="absolute bottom-3 right-3 text-[10px] leading-relaxed text-steel/70 text-right pointer-events-none select-none">
            Drag to rotate · Scroll to zoom<br />Right-drag to tilt · Double-click to reset
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel p-4">
            <div className="label mb-2">Armory</div>
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto scroll-thin pr-1">
              {ALL_WEAPONS.map((id) => {
                const wp = WEAPONS[id];
                return (
                  <button
                    key={id}
                    onClick={() => { setActive(id); sound.ui(); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 border transition-colors ${active === id ? "border-accent bg-accent/15 text-accent" : "border-base-500 bg-base-700 text-steel hover:bg-base-600 hover:text-white"}`}
                  >
                    <span className="flex items-center gap-2">
                      <Target size={15} />
                      <span className="font-semibold">{wp.name}</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wider opacity-70">{CATEGORY_LABEL[wp.category]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="panel p-4">
            <div className="label mb-3">{w.name} · {CATEGORY_LABEL[w.category]}</div>
            <StatBar label="Damage" value={w.damage} max={120} />
            <StatBar label="Fire rate" value={w.fireRate} max={13} />
            <StatBar label="Magazine" value={w.mag} max={30} />
            <StatBar label="Range" value={w.range} max={300} />
            <div className="flex flex-wrap gap-2 mt-3 text-[11px] text-steel">
              <span className="chip border-base-500">{w.auto ? "Automatic" : "Semi-auto"}</span>
              <span className="chip border-base-500">Reload {w.reload}s</span>
              <span className="chip border-base-500">x{w.headshotMult} headshot</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <SlotCard title="Armor" body="Plate carrier" />
        <SlotCard title="Gadget" body="Frag · Flash · Smoke" />
        <SlotCard title="Operator skin" body="Woodland · Mercenary · Raider" />
        <SlotCard title="Weapon finish" body="Camo & patterns" />
      </div>

      <div className="panel p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="label">Cosmetics</span>
          <span className="chip border-base-500 text-steel">Coming soon</span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="aspect-square border border-base-600 bg-base-900 flex items-center justify-center text-steel/25">
              <Lock size={16} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-steel">{label}</span>
        <span className="font-mono text-white">{value}</span>
      </div>
      <div className="h-1.5 bg-base-900 border border-base-600">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SlotCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel p-4 relative">
      <div className="label">{title}</div>
      <div className="text-white font-semibold mt-1">{body}</div>
      <Lock size={14} className="absolute top-3 right-3 text-steel/50" />
    </div>
  );
}
