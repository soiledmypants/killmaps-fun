import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useEditor } from "../lib/store";
import { usePlayer } from "../lib/player";
import { api, ApiError } from "../lib/api";
import { blankMap } from "../lib/geometry";
import { ASSETS, CATEGORIES, getAsset, type AssetCategory } from "../lib/assets";
import { EditorScene } from "../three/EditorScene";
import { IdentityModal } from "../components/IdentityModal";
import { Move, Rotate, Scale, Copy, Trash, Undo, Redo, Save, Play, Globe, Target, X } from "../components/icons";
import type { MapObject, Vec3 } from "../lib/types";
import { resolveRules, ALL_WEAPONS, WEAPONS } from "../lib/fps";

export default function CreateMap() {
  const { id } = useParams();
  const nav = useNavigate();
  const { wallet, username, player } = usePlayer();
  const {
    map, selectedId, placing, transformMode, snap, snapSize, rotSnap, scaleSnap, dirty, past, future,
    loadMap, setPlacing, select, setTransformMode, toggleSnap, setSnapSize, toggleRotSnap, toggleScaleSnap,
    deleteObject, duplicateSelected, updateObject, setMeta, undo, redo, markClean,
  } = useEditor();

  const [cat, setCat] = useState<AssetCategory>("structure");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needId, setNeedId] = useState(false);
  const [showId, setShowId] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing map or seed a blank one.
  useEffect(() => {
    if (id) {
      api.getMap(id).then(loadMap).catch(() => setError("Map not found"));
    } else if (wallet) {
      loadMap(blankMap(wallet, username));
    } else {
      setNeedId(true);
    }
  }, [id, wallet]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = map?.objects.find((o) => o.id === selectedId) || null;

  const doSave = useCallback(async () => {
    if (!map) return null;
    if (!wallet) {
      setNeedId(true);
      return null;
    }
    setSaving(true);
    setError(null);
    try {
      const exists = id || (await api.getMap(map.map_id).then(() => true).catch(() => false));
      const payload = { ...map, creator: wallet, creator_username: username };
      const saved = exists ? await api.saveMap(payload) : await api.createMap(payload);
      markClean(saved);
      setStatus("Saved");
      setTimeout(() => setStatus(null), 1500);
      if (!id) nav(`/edit/${saved.map_id}`, { replace: true });
      return saved;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
      return null;
    } finally {
      setSaving(false);
    }
  }, [map, wallet, username, id, nav, markClean]);

  const doTest = async () => {
    const saved = await doSave();
    if (saved) nav(`/game/${saved.map_id}?test=1`);
  };

  const doPublish = async () => {
    const saved = await doSave();
    if (!saved) return;
    try {
      const pub = await api.publishMap(saved.map_id, !saved.published);
      markClean(pub);
      setStatus(pub.published ? "Published" : "Unpublished");
      setTimeout(() => setStatus(null), 1500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Publish failed");
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") selectedId && deleteObject(selectedId);
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); doSave(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); }
      else if (e.key === "g") setTransformMode("translate");
      else if (e.key === "r") setTransformMode("rotate");
      else if (e.key === "t") setTransformMode("scale");
      else if (e.key === "Escape") { setPlacing(null); select(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, deleteObject, undo, redo, duplicateSelected, doSave, setTransformMode, setPlacing, select]);

  if (needId || !wallet)
    return (
      <>
        <GateBar />
        <div className="flex items-center justify-center h-[calc(100vh-3rem)] grid-backdrop">
          <div className="panel p-8 max-w-md text-center">
            <Target size={28} className="text-accent mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-2">Set your identity to build</h2>
            <p className="text-steel text-sm mb-5">Maps are tied to your payout wallet so you can earn from verified kills on them.</p>
            <button className="btn btn-accent mx-auto" onClick={() => setShowId(true)}>Set identity</button>
          </div>
        </div>
        {showId && <IdentityModal onClose={() => setShowId(false)} />}
      </>
    );

  const assets = ASSETS.filter((a) => a.category === cat);

  return (
    <div className="h-screen flex flex-col bg-base-900 text-white overflow-hidden">
      {/* Top bar */}
      <div className="h-12 shrink-0 border-b border-base-500 bg-base-800 flex items-center gap-2 px-3">
        <Link to="/" className="flex items-center gap-2 mr-2">
          <span className="text-lg leading-none">🐂</span>
          <span className="font-display text-sm hidden sm:block border-b-2 border-accent">BULL<span className="text-accent">STRIKE</span></span>
        </Link>
        <input
          className="bg-transparent border-0 text-sm font-semibold text-white focus:outline-none w-44 sm:w-56 border-b border-transparent focus:border-accent/50"
          value={map?.title || ""}
          placeholder="Map title"
          onChange={(e) => setMeta({ title: e.target.value })}
        />
        <div className="flex items-center gap-1 ml-1">
          <ToolBtn active={transformMode === "translate"} onClick={() => setTransformMode("translate")} title="Move (G)"><Move size={16} /></ToolBtn>
          <ToolBtn active={transformMode === "rotate"} onClick={() => setTransformMode("rotate")} title="Rotate (R)"><Rotate size={16} /></ToolBtn>
          <ToolBtn active={transformMode === "scale"} onClick={() => setTransformMode("scale")} title="Scale (T)"><Scale size={16} /></ToolBtn>
          <div className="w-px h-5 bg-base-500 mx-1" />
          <ToolBtn onClick={undo} disabled={!past.length} title="Undo"><Undo size={16} /></ToolBtn>
          <ToolBtn onClick={redo} disabled={!future.length} title="Redo"><Redo size={16} /></ToolBtn>
          <button onClick={toggleSnap} title="Grid snap" className={`ml-1 px-2 py-1 text-[11px] font-semibold uppercase border ${snap ? "border-accent/50 text-accent bg-accent/10" : "border-base-500 text-steel"}`}>
            Grid {snap ? snapSize : "off"}
          </button>
          <button onClick={toggleRotSnap} title="Rotation snap (15°)" className={`px-2 py-1 text-[11px] font-semibold uppercase border ${rotSnap ? "border-accent/50 text-accent bg-accent/10" : "border-base-500 text-steel"}`}>
            Rot
          </button>
          <button onClick={toggleScaleSnap} title="Scale snap (0.25)" className={`px-2 py-1 text-[11px] font-semibold uppercase border ${scaleSnap ? "border-accent/50 text-accent bg-accent/10" : "border-base-500 text-steel"}`}>
            Scl
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {status && <span className="text-verify text-xs font-semibold">{status}</span>}
          {error && <span className="text-kill text-xs font-semibold max-w-[200px] truncate">{error}</span>}
          {dirty && <span className="text-steel text-xs">●</span>}
          <button className="btn btn-ghost h-8 px-3" onClick={doTest}><Play size={15} /> <span className="hidden sm:inline">Test</span></button>
          <button className="btn h-8 px-3" onClick={doSave} disabled={saving}><Save size={15} /> <span className="hidden sm:inline">{saving ? "Saving" : "Save"}</span></button>
          <button className={`btn h-8 px-3 ${map?.published ? "btn-danger" : "btn-accent"}`} onClick={doPublish}>
            <Globe size={15} /> <span className="hidden sm:inline">{map?.published ? "Unpublish" : "Publish"}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left palette */}
        <div className="w-52 shrink-0 border-r border-base-500 bg-base-800 flex flex-col">
          <div className="flex flex-wrap gap-1 p-2 border-b border-base-500">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider border ${cat === c.id ? "border-accent/50 text-accent bg-accent/10" : "border-base-600 text-steel hover:text-white"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin p-2 space-y-1">
            {assets.map((a) => (
              <button
                key={a.kind}
                onClick={() => setPlacing(placing === a.kind ? null : a.kind)}
                className={`w-full text-left px-3 py-2 border flex items-center gap-2 transition-colors ${placing === a.kind ? "border-accent bg-accent/15 text-accent" : "border-base-600 bg-base-700 hover:bg-base-600 text-steel hover:text-white"}`}
              >
                <span className="w-3 h-3 border border-black/30" style={{ background: a.color }} />
                <span className="text-sm font-medium">{a.label}</span>
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-base-500 text-[11px] text-steel leading-relaxed">
            {placing ? <span className="text-accent">Click in the arena to place. Esc to cancel.</span> : "Select a piece, then click the ground."}
          </div>
        </div>

        {/* Center viewport */}
        <div className="flex-1 relative min-w-0">
          {map ? <EditorScene /> : <div className="flex items-center justify-center h-full text-steel">Loading editor…</div>}
          <div className="absolute bottom-3 left-3 text-[11px] text-steel/70 font-mono pointer-events-none">
            {map?.objects.length || 0} objects · {map?.objects.filter((o) => o.kind === "spawn" || o.kind === "team_spawn").length || 0} spawns
          </div>
        </div>

        {/* Right inspector */}
        <div className="w-64 shrink-0 border-l border-bark-600 bg-bark-800 overflow-y-auto scroll-thin">
          {selected ? (
            <Inspector
              object={selected}
              onChange={(p) => updateObject(selected.id, p)}
              onDelete={() => deleteObject(selected.id)}
              onDuplicate={duplicateSelected}
              onClose={() => select(null)}
            />
          ) : (
            <MapSettings map={map} onMeta={setMeta} />
          )}
        </div>
      </div>
    </div>
  );
}

function GateBar() {
  return (
    <div className="h-12 border-b border-base-500 bg-base-800 flex items-center px-4">
      <Link to="/" className="flex items-center gap-2"><span className="text-lg leading-none">🐂</span><span className="font-display text-sm text-white border-b-2 border-accent">BULL<span className="text-accent">STRIKE</span></span></Link>
    </div>
  );
}

function ToolBtn({ children, active, onClick, disabled, title }: { children: React.ReactNode; active?: boolean; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 flex items-center justify-center border ${active ? "border-accent/60 bg-accent/15 text-accent" : "border-base-600 text-steel hover:text-white hover:bg-base-600"} disabled:opacity-30`}
    >
      {children}
    </button>
  );
}

function Inspector({ object, onChange, onDelete, onDuplicate, onClose }: {
  object: MapObject;
  onChange: (p: Partial<MapObject>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  const def = getAsset(object.kind);
  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="label">Selected</div>
          <div className="font-bold text-white">{def.label}</div>
        </div>
        <button className="text-steel hover:text-white" onClick={onClose}><X size={16} /></button>
      </div>

      <VecRow label="Position" value={object.position} step={0.5} onChange={(v) => onChange({ position: v })} />
      <VecRow label="Rotation°" value={object.rotation.map((r) => +(r * 57.2958).toFixed(1)) as Vec3} step={15} onChange={(v) => onChange({ rotation: v.map((d) => d / 57.2958) as Vec3 })} />
      <VecRow label="Scale" value={object.scale} step={0.25} min={0.1} onChange={(v) => onChange({ scale: v })} />

      {(object.kind === "team_spawn") && (
        <div>
          <div className="label mb-1">Team</div>
          <div className="flex gap-1">
            {(["A", "B"] as const).map((t) => (
              <button key={t} onClick={() => onChange({ settings: { ...object.settings, team: t } })}
                className={`flex-1 py-1.5 text-sm font-semibold border ${object.settings?.team === t ? (t === "A" ? "border-[#3E8E3E] bg-[#3E8E3E]/20 text-[#7BC87B]" : "border-[#A0692F] bg-[#A0692F]/20 text-[#C89A6A]") : "border-base-500 text-steel"}`}>
                {t === "A" ? "🐂 Bulls" : "🐻 Bears"}
              </button>
            ))}
          </div>
        </div>
      )}

      {object.kind === "pickup_weapon" && (
        <div>
          <div className="label mb-1">Grants weapon</div>
          <select className="input text-xs" value={object.settings?.weapon || "m4"} onChange={(e) => onChange({ settings: { ...object.settings, weapon: e.target.value } })}>
            {ALL_WEAPONS.map((id) => (
              <option key={id} value={id}>{WEAPONS[id].name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div className="label mb-1">Color</div>
        <input type="color" value={object.color || def.color} onChange={(e) => onChange({ color: e.target.value })} className="w-full h-8 bg-base-900 border border-base-500 cursor-pointer" />
      </div>

      <div className="flex gap-2 pt-2 border-t border-base-500">
        <button className="btn flex-1 h-9" onClick={onDuplicate}><Copy size={15} /> Dup</button>
        <button className="btn btn-danger flex-1 h-9" onClick={onDelete}><Trash size={15} /> Delete</button>
      </div>
      <p className="text-[11px] text-steel/70">{def.hint}</p>
    </div>
  );
}

function MapSettings({ map, onMeta }: { map: any; onMeta: (p: any) => void }) {
  if (!map) return null;
  return (
    <div className="p-3 space-y-4">
      <div className="label">Map Settings</div>
      <div>
        <div className="label mb-1">Title</div>
        <input className="input" value={map.title} onChange={(e) => onMeta({ title: e.target.value })} />
      </div>
      <div>
        <div className="label mb-1">Description</div>
        <textarea className="input h-20 resize-none" value={map.description || ""} onChange={(e) => onMeta({ description: e.target.value })} />
      </div>
      <div>
        <div className="label mb-1">Lighting</div>
        <div className="grid grid-cols-2 gap-1">
          {["forest", "dusk", "night", "indoor"].map((p) => (
            <button key={p} onClick={() => onMeta({ lighting: { ...map.lighting, preset: p } })}
              className={`py-1.5 text-[11px] font-semibold uppercase border ${map.lighting?.preset === p ? "border-accent bg-accent/15 text-accent" : "border-base-500 text-steel"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <MatchRules map={map} onMeta={onMeta} />

      <div className="pt-3 border-t border-base-500 text-[11px] text-steel leading-relaxed space-y-1">
        <p className="text-white font-semibold">Editor controls</p>
        <p>WASD move · Right-drag look · Middle pan · Wheel zoom · Q/E down/up · Shift faster · F focus</p>
        <p>Click a piece then click the ground to place · G move · R rotate · T scale · Del delete · Ctrl+Z/Y undo</p>
      </div>
    </div>
  );
}

function MatchRules({ map, onMeta }: { map: any; onMeta: (p: any) => void }) {
  const r = resolveRules(map);
  const npc = map.rules?.npc_count ?? 3;
  const setRules = (patch: any) => onMeta({ rules: { ...r, npc_count: npc, ...patch } });
  const toggleWeapon = (id: string) => {
    const has = r.allowed_weapons.includes(id);
    let allowed = has ? r.allowed_weapons.filter((w: string) => w !== id) : [...r.allowed_weapons, id];
    if (allowed.length === 0) allowed = [id];
    const starting = allowed.includes(r.starting_weapon) ? r.starting_weapon : allowed[0];
    setRules({ allowed_weapons: allowed, starting_weapon: starting });
  };
  return (
    <div className="pt-3 border-t border-base-500">
      <div className="label mb-2">Match Rules</div>
      <div className="label text-[9px] mb-1">Allowed weapons</div>
      <div className="grid grid-cols-2 gap-1 mb-3">
        {ALL_WEAPONS.map((id) => (
          <button key={id} onClick={() => toggleWeapon(id)}
            className={`py-1 text-[10px] font-semibold uppercase border ${r.allowed_weapons.includes(id) ? "border-accent/60 bg-accent/15 text-accent" : "border-base-500 text-steel"}`}>
            {WEAPONS[id].name}
          </button>
        ))}
      </div>
      <div className="label text-[9px] mb-1">Starting weapon</div>
      <select className="input mb-3 text-xs" value={r.starting_weapon} onChange={(e) => setRules({ starting_weapon: e.target.value })}>
        {r.allowed_weapons.map((id: string) => (
          <option key={id} value={id}>{WEAPONS[id].name}</option>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="label text-[9px] mb-1">Health</div>
          <input type="number" className="input py-1 text-xs" value={r.health} min={1} onChange={(e) => setRules({ health: parseInt(e.target.value) || 100 })} />
        </div>
        <div>
          <div className="label text-[9px] mb-1">Armor</div>
          <input type="number" className="input py-1 text-xs" value={r.armor} min={0} onChange={(e) => setRules({ armor: parseInt(e.target.value) || 0 })} />
        </div>
        <div>
          <div className="label text-[9px] mb-1">NPCs (0-10)</div>
          <input type="number" className="input py-1 text-xs" value={npc} min={0} max={10} onChange={(e) => setRules({ npc_count: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)) })} />
        </div>
      </div>
      <p className="text-[10px] text-steel/60 mt-2 leading-relaxed">NPCs are practice targets only and pay 0 SOL — the real game is PvP. Rotate spawn points (R) to set which way players face.</p>
    </div>
  );
}

function VecRow({ label, value, onChange, step = 1, min }: { label: string; value: Vec3; onChange: (v: Vec3) => void; step?: number; min?: number }) {
  const set = (i: number, n: number) => {
    const v = [...value] as Vec3;
    v[i] = n;
    onChange(v);
  };
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="grid grid-cols-3 gap-1">
        {(["X", "Y", "Z"] as const).map((ax, i) => (
          <div key={ax} className="relative">
            <span className="absolute left-1.5 top-1.5 text-[10px] text-steel/60">{ax}</span>
            <input
              type="number"
              step={step}
              min={min}
              value={+value[i].toFixed(2)}
              onChange={(e) => set(i, parseFloat(e.target.value) || 0)}
              className="input pl-5 pr-1 py-1 text-xs"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
