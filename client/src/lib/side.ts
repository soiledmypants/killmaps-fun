import { create } from "zustand";

// Bull vs Bear side selection — cosmetic team identity only. Client-side state,
// persisted to localStorage. Does NOT touch the backend or affect gameplay.
export type Side = "bull" | "bear";

const LS_KEY = "bullstrike.side";

export interface SideDef {
  id: Side;
  name: string;
  icon: string; // emoji placeholder — real art comes later
  color: string; // team accent
  description: string;
}

export const SIDES: Record<Side, SideDef> = {
  bull: {
    id: "bull",
    name: "BULL",
    icon: "🐂",
    color: "#2D5A27",
    description: "A muscular bull in a tactical vest, helmet and combat boots. Charges the market — and the treeline.",
  },
  bear: {
    id: "bear",
    name: "BEAR",
    icon: "🐻",
    color: "#5A3A1F",
    description: "A grizzly bear in tactical gear, body armor and a balaclava. Patient, heavy, and always short.",
  },
};

function load(): Side | null {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v === "bull" || v === "bear" ? v : null;
  } catch {
    return null;
  }
}

interface SideState {
  side: Side | null;
  choose: (side: Side) => void;
  clear: () => void;
}

export const useSide = create<SideState>((set) => ({
  side: load(),
  choose: (side) => {
    try {
      localStorage.setItem(LS_KEY, side);
    } catch {
      /* private mode — selection just won't persist */
    }
    set({ side });
  },
  clear: () => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
    set({ side: null });
  },
}));

/** Cosmetic side icon for any player name in the kill feed: your own name uses your
 *  chosen side; other names get a stable bull/bear assignment from a name hash. */
export function sideIconFor(name: string, mySide: Side | null, myName?: string): string {
  if (mySide && (name === "You" || (myName && name === myName))) return SIDES[mySide].icon;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return (h & 1) === 0 ? SIDES.bull.icon : SIDES.bear.icon;
}
