import { create } from "zustand";
import { api, ApiError } from "./api";
import type { Player, PublicConfig } from "./types";

const LS_KEY = "killmaps.identity";

interface Stored {
  wallet: string;
  username: string;
}

function load(): Stored | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

interface PlayerState {
  wallet: string;
  username: string;
  player: Player | null;
  config: PublicConfig | null;
  busy: boolean;
  error: string | null;
  loaded: boolean;
  init: () => Promise<void>;
  register: (wallet: string, username: string) => Promise<boolean>;
  verify: () => Promise<void>;
  signOut: () => void;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  wallet: "",
  username: "",
  player: null,
  config: null,
  busy: false,
  error: null,
  loaded: false,

  init: async () => {
    let config: PublicConfig | null = null;
    try {
      config = await api.config();
    } catch {
      /* config is best-effort */
    }
    const stored = load();
    if (stored?.wallet) {
      try {
        const player = await api.getPlayer(stored.wallet);
        set({ wallet: stored.wallet, username: player.username, player, config, loaded: true });
        return;
      } catch {
        set({ wallet: stored.wallet, username: stored.username, config, loaded: true });
        return;
      }
    }
    set({ config, loaded: true });
  },

  register: async (wallet, username) => {
    set({ busy: true, error: null });
    try {
      const player = await api.registerPlayer(wallet.trim(), username.trim());
      localStorage.setItem(LS_KEY, JSON.stringify({ wallet: player.wallet, username: player.username }));
      set({ wallet: player.wallet, username: player.username, player, busy: false });
      return true;
    } catch (e) {
      set({ busy: false, error: e instanceof ApiError ? e.message : "Registration failed" });
      return false;
    }
  },

  verify: async () => {
    const { wallet } = get();
    if (!wallet) return;
    set({ busy: true, error: null });
    try {
      const { player } = await api.verifyPlayer(wallet, true);
      set({ player, busy: false });
    } catch (e) {
      set({ busy: false, error: e instanceof ApiError ? e.message : "Verification failed" });
    }
  },

  signOut: () => {
    localStorage.removeItem(LS_KEY);
    set({ wallet: "", username: "", player: null });
  },
}));
