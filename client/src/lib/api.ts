import type { GameMap, Player, Transaction, RewardsView, PublicConfig } from "./types";

// In dev, VITE_API_URL is unset -> calls hit "/api" and Vite proxies to the local
// backend. In production (Netlify), set VITE_API_URL to the Render backend URL.
const ENV_API = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
const DEV = import.meta.env.DEV;
const PROD = import.meta.env.PROD;
const API_ORIGIN = ENV_API || (PROD ? "" : "");
const BASE = `${API_ORIGIN}/api`;

const MISCONFIGURED = PROD && !API_ORIGIN;
if (MISCONFIGURED && typeof console !== "undefined") {
  console.error("[api] No VITE_API_URL set for this production build.");
}

/** A user-safe error. `.message` is always clean (never HTML / stack traces). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (MISCONFIGURED) throw new ApiError("App is not configured to reach the server.");
  if (DEV) console.log(`[api] ${init?.method || "GET"} ${BASE}${path}`);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch (err) {
    if (DEV) console.error("[api] network/CORS failure:", path, err);
    throw new ApiError("Connection error. Please retry.");
  }

  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("application/json")) {
    if (DEV) console.error(`[api] non-JSON ${res.status} from ${path}`);
    throw new ApiError(res.status >= 500 ? "Server unavailable. Please try again." : "Unexpected server response.", res.status);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ApiError("Unexpected server response.", res.status);
  }
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : `Request failed (${res.status}).`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

export interface KillResult {
  counted: boolean;
  reasons: string[];
  score: number;
  kill: { id: string };
}

export const api = {
  config: (): Promise<PublicConfig> => request("/config"),
  treasury: (): Promise<{ treasury: number; rewards: number; treasuryWallet: string | null; rewardsWallet: string | null; onchain: boolean; cluster: string; solscanCluster: string }> =>
    request("/treasury"),

  // ---- players ----
  registerPlayer: (wallet: string, username: string): Promise<Player> =>
    request("/players/register", jsonInit("POST", { wallet, username })),
  verifyPlayer: (wallet: string, force = false): Promise<{ player: Player; result: any }> =>
    request("/players/verify", jsonInit("POST", { wallet, force })),
  getPlayer: (wallet: string): Promise<Player> => request(`/players/${wallet}`),

  // ---- maps ----
  listMaps: (params?: { creator?: string; published?: boolean; sort?: string }): Promise<GameMap[]> => {
    const q = new URLSearchParams();
    if (params?.creator) q.set("creator", params.creator);
    if (params?.published !== undefined) q.set("published", String(params.published));
    if (params?.sort) q.set("sort", params.sort);
    return request(`/maps?${q.toString()}`);
  },
  getMap: (id: string): Promise<GameMap> => request(`/maps/${id}`),
  createMap: (map: GameMap): Promise<GameMap> => request("/maps", jsonInit("POST", map)),
  saveMap: (map: GameMap): Promise<GameMap> => request(`/maps/${map.map_id}`, jsonInit("PUT", map)),
  deleteMap: (id: string): Promise<{ ok: boolean }> => request(`/maps/${id}`, jsonInit("DELETE")),
  publishMap: (id: string, published: boolean): Promise<GameMap> =>
    request(`/maps/${id}/publish`, jsonInit("POST", { published })),

  // ---- matches + kills ----
  startMatch: (map_id: string, mode: string, wallet?: string): Promise<{ match: { match_id: string }; map: GameMap }> =>
    request("/matches/start", jsonInit("POST", { map_id, mode, wallet })),
  matchEvent: (match_id: string, body: { wallet?: string; distance?: number; joined?: boolean }): Promise<{ ok: boolean }> =>
    request(`/matches/${match_id}/event`, jsonInit("POST", body)),
  endMatch: (match_id: string): Promise<unknown> => request(`/matches/${match_id}/end`, jsonInit("POST", {})),
  recordKill: (body: Record<string, unknown>): Promise<KillResult> => request("/kills/record", jsonInit("POST", body)),

  // ---- rewards (read-only — the ledger settles automatically every 5 min) ----
  rewards: (wallet: string): Promise<RewardsView> => request(`/rewards/${wallet}`),

  // ---- live room counts ----
  rooms: (): Promise<{ counts: Record<string, number>; maxPlayers: number }> => request("/rooms"),

  transactions: (): Promise<Transaction[]> => request("/transactions"),
  leaderboard: (): Promise<{ wallet: string; username: string | null; verified_kills: number; unique_players: number; maps: number }[]> =>
    request("/leaderboard"),
};
