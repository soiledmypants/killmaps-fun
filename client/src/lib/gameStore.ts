import { create } from "zustand";
import type { WeaponId } from "./fps";

export interface FeedItem {
  id: string;
  killer: string;
  victim: string;
  weapon: string;
  head?: boolean;
  self?: boolean;
}

export type GameStatus = "loading" | "ready" | "playing" | "over";

interface GameState {
  status: GameStatus;
  health: number;
  maxHealth: number;
  weapon: WeaponId;
  ammo: number;
  mag: number;
  reloading: boolean;
  kills: number;
  deaths: number;
  score: number;
  timeLeft: number;
  feed: FeedItem[];
  hitMarker: number; // timestamp of last hit (for crosshair flash)
  headMarker: number; // timestamp of last headshot
  notice: string | null; // transient pickup / event notification
  noticeAt: number;
  lastKillInfo: string | null; // anti-farm reason / counted status from server
  bots: { id: string; name: string; kills: number; deaths: number }[];

  set: (p: Partial<GameState>) => void;
  pushFeed: (f: Omit<FeedItem, "id">) => void;
  reset: (weapon: WeaponId, mag: number, time: number) => void;
}

export const useGame = create<GameState>((set) => ({
  status: "loading",
  health: 100,
  maxHealth: 100,
  weapon: "m4",
  ammo: 30,
  mag: 30,
  reloading: false,
  kills: 0,
  deaths: 0,
  score: 0,
  timeLeft: 0,
  feed: [],
  hitMarker: 0,
  headMarker: 0,
  notice: null,
  noticeAt: 0,
  lastKillInfo: null,
  bots: [],

  set: (p) => set(p),
  pushFeed: (f) =>
    set((s) => ({ feed: [{ ...f, id: Math.random().toString(36).slice(2) }, ...s.feed].slice(0, 6) })),
  reset: (weapon, mag, time) =>
    set({
      status: "ready",
      health: 100,
      maxHealth: 100,
      weapon,
      ammo: mag,
      mag,
      reloading: false,
      kills: 0,
      deaths: 0,
      score: 0,
      timeLeft: time,
      feed: [],
      hitMarker: 0,
      headMarker: 0,
      lastKillInfo: null,
    }),
}));
