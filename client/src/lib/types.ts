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
    weapon?: "rifle" | "pistol" | "shotgun";
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
  lighting: { preset: "indoor" | "dusk" | "night" | "warehouse"; intensity: number };
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
  creator_points: number;
  player_points: number;
  creator_claimed: number;
  player_claimed: number;
  creator_sol: number;
  player_sol: number;
  creator_unlocked: boolean;
  points_per_sol: number;
  min_creator_claim_points: number;
  min_player_claim_points: number;
  maps: {
    map_id: string;
    title: string;
    verified_kills: number;
    unique_verified_players: number;
    creator_points: number;
    unlocked: boolean;
  }[];
  unlock_progress: {
    map_id: string;
    title: string;
    players: number;
    players_needed: number;
    kills: number;
    kills_needed: number;
  } | null;
}

export interface PublicConfig {
  cluster: string;
  solscanCluster: string;
  tokenCA: string | null;
  minTokens: number;
  verifyLive: boolean;
  devVerifyOff: boolean;
  onchain: boolean;
  rpcConfigured: boolean;
  treasuryWallet: string | null;
  rewardsWallet: string | null;
  pointsPerSol: number;
  creatorPointsPerKill: number;
  playerPointsPerKill: number;
  minCreatorClaimPoints: number;
  minPlayerClaimPoints: number;
  antifarm: {
    spawnProtectionMs: number;
    minMatchMs: number;
    pairCooldownMs: number;
    pairDailyCap: number;
    creatorMinUniquePlayers: number;
    creatorMinVerifiedKills: number;
  };
}
