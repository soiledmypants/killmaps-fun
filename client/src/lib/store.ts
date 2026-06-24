import { create } from "zustand";
import type { GameMap, MapObject, Vec3, AssetKind } from "./types";
import { getAsset } from "./assets";
import { uid, snapVec } from "./geometry";

export type TransformMode = "translate" | "rotate" | "scale";

interface EditorState {
  map: GameMap | null;
  selectedId: string | null;
  placing: AssetKind | null; // armed for placement (ghost follows cursor)
  transformMode: TransformMode;
  snap: boolean;
  snapSize: number;
  rotSnap: boolean;
  scaleSnap: boolean;
  dirty: boolean;
  past: GameMap[];
  future: GameMap[];

  loadMap: (m: GameMap) => void;
  commit: (m: GameMap, opts?: { history?: boolean }) => void;
  setPlacing: (k: AssetKind | null) => void;
  select: (id: string | null) => void;
  setTransformMode: (m: TransformMode) => void;
  toggleSnap: () => void;
  setSnapSize: (n: number) => void;
  toggleRotSnap: () => void;
  toggleScaleSnap: () => void;

  addObject: (kind: AssetKind, position: Vec3) => string;
  updateObject: (id: string, patch: Partial<MapObject>, history?: boolean) => void;
  deleteObject: (id: string) => void;
  duplicateSelected: () => void;
  setMeta: (patch: Partial<Pick<GameMap, "title" | "description" | "lighting" | "rules">>) => void;

  undo: () => void;
  redo: () => void;
  markClean: (m: GameMap) => void;
}

const HISTORY_LIMIT = 60;

export const useEditor = create<EditorState>((set, get) => ({
  map: null,
  selectedId: null,
  placing: null,
  transformMode: "translate",
  snap: true,
  snapSize: 1,
  rotSnap: true,
  scaleSnap: true,
  dirty: false,
  past: [],
  future: [],

  loadMap: (m) => set({ map: m, selectedId: null, placing: null, dirty: false, past: [], future: [] }),

  commit: (m, opts = { history: true }) =>
    set((s) => {
      if (!s.map) return { map: m };
      const past = opts.history ? [...s.past, s.map].slice(-HISTORY_LIMIT) : s.past;
      return { map: { ...m, updated_at: Date.now() }, dirty: true, past, future: opts.history ? [] : s.future };
    }),

  setPlacing: (placing) => set({ placing, selectedId: null }),
  select: (id) => set({ selectedId: id, placing: null }),
  setTransformMode: (transformMode) => set({ transformMode }),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  setSnapSize: (snapSize) => set({ snapSize }),
  toggleRotSnap: () => set((s) => ({ rotSnap: !s.rotSnap })),
  toggleScaleSnap: () => set((s) => ({ scaleSnap: !s.scaleSnap })),

  addObject: (kind, position) => {
    const def = getAsset(kind);
    const id = uid();
    const { snap, snapSize, map } = get();
    if (!map) return id;
    const pos = snap ? snapVec(position, snapSize) : position;
    const o: MapObject = {
      id,
      kind,
      position: [pos[0], pos[1], pos[2]],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: def.color,
      settings: kind === "team_spawn" ? { team: "A" } : kind === "pickup_weapon" ? { weapon: "rifle" } : {},
    };
    get().commit({ ...map, objects: [...map.objects, o] });
    set({ selectedId: id });
    return id;
  },

  updateObject: (id, patch, history = true) => {
    const { map } = get();
    if (!map) return;
    const objects = map.objects.map((o) => (o.id === id ? { ...o, ...patch } : o));
    get().commit({ ...map, objects }, { history });
  },

  deleteObject: (id) => {
    const { map } = get();
    if (!map) return;
    get().commit({ ...map, objects: map.objects.filter((o) => o.id !== id) });
    set((s) => ({ selectedId: s.selectedId === id ? null : s.selectedId }));
  },

  duplicateSelected: () => {
    const { map, selectedId } = get();
    if (!map || !selectedId) return;
    const src = map.objects.find((o) => o.id === selectedId);
    if (!src) return;
    const id = uid();
    const copy: MapObject = { ...src, id, position: [src.position[0] + 2, src.position[1], src.position[2] + 2] };
    get().commit({ ...map, objects: [...map.objects, copy] });
    set({ selectedId: id });
  },

  setMeta: (patch) => {
    const { map } = get();
    if (!map) return;
    get().commit({ ...map, ...patch }, { history: false });
  },

  undo: () =>
    set((s) => {
      if (!s.map || s.past.length === 0) return s;
      const prev = s.past[s.past.length - 1];
      return { map: prev, past: s.past.slice(0, -1), future: [s.map, ...s.future].slice(0, HISTORY_LIMIT), dirty: true, selectedId: null };
    }),

  redo: () =>
    set((s) => {
      if (!s.map || s.future.length === 0) return s;
      const next = s.future[0];
      return { map: next, future: s.future.slice(1), past: [...s.past, s.map].slice(-HISTORY_LIMIT), dirty: true, selectedId: null };
    }),

  markClean: (m) => set({ map: m, dirty: false }),
}));
