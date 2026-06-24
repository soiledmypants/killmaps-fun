export type Vec3 = [number, number, number];

// All placeable object kinds in the FPS map builder. Mirrors server expectations.
export type AssetKind =
  | "floor"
  | "wall"
  | "ramp"
  | "stairs"
  | "platform"
  | "elevated_platform"
  | "tunnel"
  | "crate"
  | "cover"
  | "barrel"
  | "obstacle"
  | "fence"
  | "door"
  | "window"
  | "spawn"
  | "team_spawn"
  | "pickup_weapon"
  | "pickup_ammo"
  | "pickup_health"
  | "light";

export interface MapObject {
  id: string;
  kind: AssetKind;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color?: string;
  settings?: {
    team?: "A" | "B";
    weapon?: string;
    intensity?: number;
  };
}

export interface SpawnPoint {
  position: Vec3;
  team?: "A" | "B";
}

export interface MapStats {
  plays: number;
  total_kills: number;
  verified_kills: number;
  unique_verified_players: number;
}

export interface GameMap {
  map_id: string;
  creator: string; // creator payout wallet
  creator_username?: string;
  title: string;
  description?: string;
  thumbnail?: string | null;
  objects: MapObject[];
  spawn_points: SpawnPoint[];
  lighting: { preset: "desert" | "dusk" | "night" | "indoor" | "warehouse"; intensity: number };
  rules?: {
    allowed_weapons: string[];
    starting_weapon: string;
    health: number;
    armor: number;
    reserve_mult?: number;
    npc_count?: number;
  };
  active_players?: number;
  max_players?: number;
  map_config?: unknown;
  published: boolean;
  test_mode?: boolean;
  created_at: number;
  updated_at: number;
  stats: MapStats;
  reward_stats?: { creator_points: number };
  abuse?: { score: number; flagged: boolean; locked: boolean };
}

export interface Player {
  wallet: string;
  username: string;
  verified: boolean;
  token_balance: number;
  verified_at: number;
  verify_mock?: boolean;
  dev_bypass?: boolean;
  stats: { kills: number; deaths: number; maps_created: number };
  created_at: number;
  updated_at?: number;
}

export interface Transaction {
  id: string;
  type: "creator_reward" | "player_reward" | string;
  wallet: string;
  amount: number;
  points: number | null;
  status: string;
  onchain: boolean;
  timestamp: number;
  tx_hash: string;
  kind?: string;
}

export interface RewardsView {
  wallet: string;
  balance: number; // settled "Ledger Balance" (USD)
  pending: number; // awaiting next settlement
  lifetime_settled: number;
  validated_kills: number;
  unique_players_today: number;
  activity_score: number;
  active_matches: number;
  next_settlement_ms: number;
  settlement_interval_ms: number;
  daily_cap: number;
  daily_pending: number;
  flagged: boolean;
  maps: {
    map_id: string;
    title: string;
    validated_kills: number;
    unique_players: number;
    plays: number;
    total_kills: number;
  }[];
}

export interface Loadout {
  primary: string;
  secondary: string;
  armor: "none" | "armor" | "helmet";
}

export interface PublicConfig {
  cluster: string;
  solscanCluster: string;
  tokenCA: string | null;
  minTokens: number;
  verifyLive: boolean;
  devVerifyOff: boolean;
  maxPlayers?: number;
  rewardPerKill?: number;
  settlementIntervalMs?: number;
  dailyCreatorCap?: number;
  onchain: boolean;
  rpcConfigured: boolean;
  treasuryWallet: string | null;
  rewardsWallet: string | null;
  antifarm: {
    spawnProtectionMs: number;
    minMatchMs: number;
    pairCooldownMs: number;
    pairDailyCap: number;
    creatorMinUniquePlayers: number;
    creatorMinVerifiedKills: number;
  };
}
