import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { api } from "../lib/api";
import type { GameMap, Loadout } from "../lib/types";
import { Fighter, PALETTES } from "../three/Fighter";
import { useLoadout } from "../lib/loadout";
import { usePlayer } from "../lib/player";
import { WEAPONS } from "../lib/fps";
import { sound } from "../lib/sound";
import { Target, Shield, Play, Wrench } from "../components/icons";
import { Nav } from "../components/Nav";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ApiError } from "../lib/api";
import { useSide, SIDES } from "../lib/side";
import { CharacterSelect, SideBadge } from "../components/CharacterSelect";

const PRIMARIES = ["m4", "ak", "mp5"];
const SECONDARIES = ["glock", "deagle"];
const ARMORS: { id: Loadout["armor"]; label: string }[] = [
  { id: "none", label: "No Armor" },
  { id: "armor", label: "Armor" },
  { id: "helmet", label: "Armor + Helmet" },
];

function Preview({ weapon }: { weapon: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s, dt) => { if (g.current) g.current.rotation.y += dt * 0.4; });
  return (
    <Canvas shadows camera={{ position: [0, 1.4, 3.8], fov: 42 }} dpr={[1, 2]}>
      <color attach="background" args={["#0D2818"]} />
      <fog attach="fog" args={["#0D2818", 5, 14]} />
      <hemisphereLight args={["#b8d4b0", "#22301C", 0.85]} />
      <directionalLight position={[5, 8, 5]} intensity={1.3} color="#ffe3a8" castShadow />
      <directionalLight position={[-5, 3, -4]} intensity={0.5} color="#8a7a3f" />
      <group ref={g}>
        <Fighter palette={PALETTES.operator} weapon={weapon} position={[0, 0, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[0.85, 0.95, 48]} /><meshBasicMaterial color="#D4A017" transparent opacity={0.5} side={THREE.DoubleSide} /></mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#1A3A2A" roughness={0.95} /></mesh>
    </Canvas>
  );
}

export default function PreMatch() {
  const { id } = useParams();
  const nav = useNavigate();
  const { loadout, setLoadout } = useLoadout();
  const { player } = usePlayer();
  const side = useSide((s) => s.side);
  const clearSide = useSide((s) => s.clear);
  const [map, setMap] = useState<GameMap | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setErr("Invalid map link");
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = (first: boolean) =>
      api
        .getMap(id)
        .then((m) => {
          if (cancelled) return;
          setMap(m);
          setErr(null);
        })
        .catch((e) => {
          console.error("[prematch] map load failed:", id, e);
          if (cancelled || !first) return; // keep showing the map on a failed refresh
          setErr(e instanceof ApiError && e.status === 404 ? "This map no longer exists" : "Map failed to load");
        })
        .finally(() => first && !cancelled && setLoading(false));
    load(true);
    const t = setInterval(() => load(false), 4000); // live player count refresh
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id]);

  if (err)
    return (
      <>
        <Nav />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="panel p-8 max-w-sm text-center">
            <h2 className="text-xl font-bold text-white mb-2">Map failed to load</h2>
            <p className="text-steel text-sm mb-5">{err}</p>
            <Link to="/play" className="btn btn-accent mx-auto">Back to Maps</Link>
          </div>
        </div>
      </>
    );
  if (loading || !map)
    return (
      <>
        <Nav />
        <div className="flex items-center justify-center min-h-[60vh] text-steel text-sm">
          <span className="animate-pulse">Loading map…</span>
        </div>
      </>
    );

  // Bull vs Bear side selection — must pick before spawning (cosmetic only).
  if (!side) return <CharacterSelect />;

  const allowed = map.rules?.allowed_weapons || PRIMARIES.concat(SECONDARIES);
  const primaries = PRIMARIES.filter((w) => allowed.includes(w));
  const secondaries = SECONDARIES.filter((w) => allowed.includes(w));
  const choose = (p: Partial<Loadout>) => { setLoadout(p); sound.ui(); };

  return (
    <>
      <Nav />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">{map.title}</h1>
            <p className="text-steel text-sm">by {map.creator_username || "creator"} · <span className="font-mono text-accent">{map.active_players ?? 0} / {map.max_players ?? 16}</span> players</p>
          </div>
          <div className="flex items-center gap-2">
            <SideBadge side={side} />
            <button className="btn btn-ghost h-9 px-2 text-xs" title="Change side" onClick={() => { sound.ui(); clearSide(); }}>Change side</button>
            <Link to="/play" className="btn h-9 px-3 text-xs">Back</Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-4">
          <div className="panel h-[460px] overflow-hidden relative">
            <ErrorBoundary label="prematch-preview" fallback={() => (
              <div className="w-full h-full grid-backdrop flex items-center justify-center text-steel text-sm">Operator preview unavailable</div>
            )}>
              <Preview weapon={loadout.primary} />
            </ErrorBoundary>
            <div className="absolute bottom-3 left-3 panel px-3 py-2 bg-base-800/80">
              <div className="label">Operator</div>
              <div className="font-bold text-white"><span className="mr-1">{SIDES[side].icon}</span>{player?.username || "Guest"}</div>
              <div className="text-[11px] text-steel">{WEAPONS[loadout.primary]?.name} · {WEAPONS[loadout.secondary]?.name} · {loadout.armor}</div>
            </div>
          </div>

          <div className="space-y-4">
            <Section title="Primary" icon={Target}>
              {primaries.map((w) => <Choice key={w} active={loadout.primary === w} label={WEAPONS[w].name} sub={WEAPONS[w].category} onClick={() => choose({ primary: w })} />)}
            </Section>
            <Section title="Secondary" icon={Target}>
              {secondaries.map((w) => <Choice key={w} active={loadout.secondary === w} label={WEAPONS[w].name} sub="pistol" onClick={() => choose({ secondary: w })} />)}
            </Section>
            <Section title="Armor" icon={Shield}>
              {ARMORS.map((a) => <Choice key={a.id} active={loadout.armor === a.id} label={a.label} onClick={() => choose({ armor: a.id })} />)}
            </Section>

            <button className="btn btn-accent w-full py-3.5 text-base" onClick={() => { sound.ui(); nav(`/game/${id}`); }}>
              <Play size={18} /> Join Match
            </button>
            <Link to={`/edit/${id}`} className="btn w-full h-9 text-xs"><Wrench size={14} /> View in editor</Link>
            <p className="text-[11px] text-steel/70 leading-relaxed">Loadout is saved for next time. Real verified kills on this map credit the creator's reward ledger.</p>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center gap-2 mb-2"><Icon size={14} className="text-accent" /><span className="label">{title}</span></div>
      <div className="grid grid-cols-1 gap-1.5">{children}</div>
    </div>
  );
}
function Choice({ active, label, sub, onClick }: { active: boolean; label: string; sub?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-between px-3 py-2.5 border transition-colors ${active ? "border-accent bg-accent/15 text-accent" : "border-base-500 bg-base-700 text-steel hover:bg-base-600 hover:text-white"}`}>
      <span className="font-semibold">{label}</span>
      {sub && <span className="text-[10px] uppercase tracking-wider opacity-70">{sub}</span>}
    </button>
  );
}
