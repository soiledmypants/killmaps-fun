import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TacticalOperator } from "../three/TacticalOperator";
import { WEAPONS, type WeaponId } from "../lib/fps";
import { Shield, Target, Lock } from "../components/icons";

function Turntable() {
  const g = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.35;
  });
  return (
    <group ref={g}>
      <TacticalOperator position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.9, 1.0, 48]} />
        <meshBasicMaterial color="#f5a623" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function OperatorPreview() {
  return (
    <Canvas shadows camera={{ position: [0, 1.4, 4.2], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={["#0c0f13"]} />
      <fog attach="fog" args={["#0c0f13", 6, 16]} />
      <hemisphereLight args={["#6a727c", "#15181b", 0.8]} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} castShadow />
      <directionalLight position={[-5, 3, -4]} intensity={0.5} color="#c89b5a" />
      <Turntable />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#15191d" roughness={0.95} />
      </mesh>
    </Canvas>
  );
}

const WEAPON_SLOTS: { id: WeaponId; slot: string }[] = [
  { id: "rifle", slot: "Primary" },
  { id: "shotgun", slot: "Secondary" },
  { id: "pistol", slot: "Sidearm" },
];

export default function Loadout() {
  const [active, setActive] = useState<WeaponId>("rifle");
  const w = WEAPONS[active];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield size={22} className="text-accent" /> Loadout
          </h1>
          <p className="text-steel text-sm mt-1">Your operator and weapon kit. Cosmetics and gadgets are coming soon.</p>
        </div>
        <span className="chip border-accent/40 bg-accent/10 text-accent">Preview · Coming soon</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        {/* Operator preview */}
        <div className="panel relative overflow-hidden h-[460px] grid-backdrop">
          <OperatorPreview />
          <div className="absolute bottom-3 left-3 panel px-3 py-2 bg-base-800/80 backdrop-blur">
            <div className="label">Operator</div>
            <div className="font-bold text-white">Vanguard-01</div>
            <div className="text-[11px] text-steel">Default tactical operator</div>
          </div>
          <div className="absolute top-3 right-3 chip border-base-500 text-steel bg-base-800/80">Cosmetics locked</div>
        </div>

        {/* Right column: weapon + slots */}
        <div className="space-y-4">
          <div className="panel p-4">
            <div className="label mb-2">Weapon slots</div>
            <div className="space-y-2">
              {WEAPON_SLOTS.map(({ id, slot }) => {
                const wp = WEAPONS[id];
                return (
                  <button
                    key={id}
                    onClick={() => setActive(id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 border transition-colors ${active === id ? "border-accent bg-accent/15 text-accent" : "border-base-500 bg-base-700 text-steel hover:bg-base-600 hover:text-white"}`}
                  >
                    <span className="flex items-center gap-2">
                      <Target size={15} />
                      <span className="font-semibold">{wp.name}</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wider opacity-70">{slot}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="panel p-4">
            <div className="label mb-3">{w.name} stats</div>
            <StatBar label="Damage" value={w.damage} max={40} />
            <StatBar label="Fire rate" value={w.fireRate} max={12} />
            <StatBar label="Magazine" value={w.mag} max={30} />
            <StatBar label="Range" value={w.range} max={120} />
            <div className="flex gap-2 mt-3 text-[11px] text-steel">
              <span className="chip border-base-500">{w.auto ? "Automatic" : "Semi-auto"}</span>
              <span className="chip border-base-500">Reload {w.reload}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment slots */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <SlotCard title="Armor" body="Plate carrier" locked />
        <SlotCard title="Gadget" body="Frag · Flash · Smoke" locked />
        <SlotCard title="Operator skin" body="Tactical variants" locked />
        <SlotCard title="Weapon finish" body="Camo & patterns" locked />
      </div>

      {/* Cosmetics grid */}
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

function SlotCard({ title, body, locked }: { title: string; body: string; locked?: boolean }) {
  return (
    <div className="panel p-4 relative">
      <div className="label">{title}</div>
      <div className="text-white font-semibold mt-1">{body}</div>
      {locked && <Lock size={14} className="absolute top-3 right-3 text-steel/50" />}
    </div>
  );
}
