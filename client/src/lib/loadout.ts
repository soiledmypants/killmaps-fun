import { create } from "zustand";
import type { Loadout } from "./types";

const KEY = "bullstrike.loadout";

function load(): Loadout {
  try {
    const r = localStorage.getItem(KEY);
    if (r) return { primary: "m4", secondary: "glock", armor: "none", ...JSON.parse(r) };
  } catch {
    /* ignore */
  }
  return { primary: "m4", secondary: "glock", armor: "none" };
}

interface State {
  loadout: Loadout;
  setLoadout: (p: Partial<Loadout>) => void;
}

export const useLoadout = create<State>((set, get) => ({
  loadout: load(),
  setLoadout: (p) => {
    const l = { ...get().loadout, ...p };
    localStorage.setItem(KEY, JSON.stringify(l));
    set({ loadout: l });
  },
}));

/** Armor points granted by the chosen vest. */
export function armorPoints(armor: Loadout["armor"]): number {
  return armor === "helmet" ? 100 : armor === "armor" ? 50 : 0;
}
