// Storage layer with a pluggable backend:
//
//   • DATABASE_URL set   -> Postgres (Neon / Supabase / Render Postgres). PERSISTENT.
//   • DATABASE_URL unset -> local JSON file (server/data/db.json). Dev only.
//
// WHY: Render's free web-service filesystem is EPHEMERAL — the JSON file is wiped on
// every deploy/restart. Setting DATABASE_URL makes data survive restarts.
//
// The whole DB is kept in an in-memory `cache` (read() is sync so route handlers stay
// simple). write() updates the cache and persists in the background; flush() forces a
// final save on shutdown (Render sends SIGTERM before recycling the instance).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "data", "db.json");

// Seed maps — DATA ONLY, no logic. Two published system maps by "BULLSTRIKE" so
// the Play Maps page isn't empty on a brand-new database. They are part of
// DEFAULT_DB, so a fresh file OR fresh Postgres state starts with them; existing
// persisted databases are never modified.
const SEED_MAPS = {
  "map_the_clearing": {
    map_id: "map_the_clearing",
    creator: "BULLSTRIKE",
    creator_username: "BULLSTRIKE",
    title: "The Clearing",
    description: "System map — a simple open clearing. Four corner spawns, crates in the middle, nowhere to hide for long.",
    thumbnail: null,
    objects: [
      {"id":"cl_00_floor","kind":"floor","position":[-16,0,-16],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"cl_01_floor","kind":"floor","position":[-16,0,0],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"cl_02_floor","kind":"floor","position":[-16,0,16],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"cl_03_floor","kind":"floor","position":[0,0,-16],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"cl_04_floor","kind":"floor","position":[0,0,0],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"cl_05_floor","kind":"floor","position":[0,0,16],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"cl_06_floor","kind":"floor","position":[16,0,-16],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"cl_07_floor","kind":"floor","position":[16,0,0],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"cl_08_floor","kind":"floor","position":[16,0,16],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"cl_09_wall","kind":"wall","position":[-18,1.7,-24],"rotation":[0,0,0],"scale":[3,1,1]},
      {"id":"cl_10_wall","kind":"wall","position":[-18,1.7,24],"rotation":[0,0,0],"scale":[3,1,1]},
      {"id":"cl_11_wall","kind":"wall","position":[-24,1.7,-18],"rotation":[0,1.5707963267948966,0],"scale":[3,1,1]},
      {"id":"cl_12_wall","kind":"wall","position":[24,1.7,-18],"rotation":[0,1.5707963267948966,0],"scale":[3,1,1]},
      {"id":"cl_13_wall","kind":"wall","position":[-6,1.7,-24],"rotation":[0,0,0],"scale":[3,1,1]},
      {"id":"cl_14_wall","kind":"wall","position":[-6,1.7,24],"rotation":[0,0,0],"scale":[3,1,1]},
      {"id":"cl_15_wall","kind":"wall","position":[-24,1.7,-6],"rotation":[0,1.5707963267948966,0],"scale":[3,1,1]},
      {"id":"cl_16_wall","kind":"wall","position":[24,1.7,-6],"rotation":[0,1.5707963267948966,0],"scale":[3,1,1]},
      {"id":"cl_17_wall","kind":"wall","position":[6,1.7,-24],"rotation":[0,0,0],"scale":[3,1,1]},
      {"id":"cl_18_wall","kind":"wall","position":[6,1.7,24],"rotation":[0,0,0],"scale":[3,1,1]},
      {"id":"cl_19_wall","kind":"wall","position":[-24,1.7,6],"rotation":[0,1.5707963267948966,0],"scale":[3,1,1]},
      {"id":"cl_20_wall","kind":"wall","position":[24,1.7,6],"rotation":[0,1.5707963267948966,0],"scale":[3,1,1]},
      {"id":"cl_21_wall","kind":"wall","position":[18,1.7,-24],"rotation":[0,0,0],"scale":[3,1,1]},
      {"id":"cl_22_wall","kind":"wall","position":[18,1.7,24],"rotation":[0,0,0],"scale":[3,1,1]},
      {"id":"cl_23_wall","kind":"wall","position":[-24,1.7,18],"rotation":[0,1.5707963267948966,0],"scale":[3,1,1]},
      {"id":"cl_24_wall","kind":"wall","position":[24,1.7,18],"rotation":[0,1.5707963267948966,0],"scale":[3,1,1]},
      {"id":"cl_25_crate","kind":"crate","position":[-1.5,0.9,0],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"cl_26_crate","kind":"crate","position":[1.5,0.9,1],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"cl_27_crate","kind":"crate","position":[0,2.3,0.5],"rotation":[0,0.4,0],"scale":[0.9,0.9,0.9]},
      {"id":"cl_28_barrel","kind":"barrel","position":[-7,0.9,6],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"cl_29_cover","kind":"cover","position":[6,0.75,-6],"rotation":[0,0.6,0],"scale":[1,1,1]},
      {"id":"cl_30_spawn","kind":"spawn","position":[12,0.3,12],"rotation":[0,0.7853981633974483,0],"scale":[1,1,1]},
      {"id":"cl_31_spawn","kind":"spawn","position":[-12,0.3,12],"rotation":[0,-0.7853981633974483,0],"scale":[1,1,1]},
      {"id":"cl_32_spawn","kind":"spawn","position":[12,0.3,-12],"rotation":[0,2.356194490192345,0],"scale":[1,1,1]},
      {"id":"cl_33_spawn","kind":"spawn","position":[-12,0.3,-12],"rotation":[0,-2.356194490192345,0],"scale":[1,1,1]},
      {"id":"cl_34_pickup_weapon","kind":"pickup_weapon","position":[0,0.6,-3],"rotation":[0,0,0],"scale":[1,1,1],"settings":{"weapon":"ak"}},
      {"id":"cl_35_pickup_ammo","kind":"pickup_ammo","position":[0,0.45,18],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"cl_36_pickup_health","kind":"pickup_health","position":[-18,0.5,0],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"cl_37_pickup_health","kind":"pickup_health","position":[18,0.5,0],"rotation":[0,0,0],"scale":[1,1,1]},
    ],
    spawn_points: [],
    lighting: {"preset":"forest","intensity":1},
    map_config: null, // rebuilt by normalizeMap on first save
    published: true,
    test_mode: false,
    created_at: 1782650000000,
    updated_at: 1782650000000,
    stats: {"plays":0,"total_kills":0,"verified_kills":0,"unique_verified_players":0},
    reward_stats: {"creator_points":0},
    verified_players: [],
    abuse: {"score":100,"flagged":false,"locked":false},
  },
  "map_timber_ridge": {
    map_id: "map_timber_ridge",
    creator: "BULLSTRIKE",
    creator_username: "BULLSTRIKE",
    title: "Timber Ridge",
    description: "System map — a forest clearing arena. Two spawn lines, mid-field logs and sandbags, and a watchtower deck on each flank.",
    thumbnail: null,
    objects: [
      {"id":"tr_00_floor","kind":"floor","position":[-24,0,-24],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_01_floor","kind":"floor","position":[-24,0,-8],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_02_floor","kind":"floor","position":[-24,0,8],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_03_floor","kind":"floor","position":[-24,0,24],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_04_floor","kind":"floor","position":[-8,0,-24],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_05_floor","kind":"floor","position":[-8,0,-8],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_06_floor","kind":"floor","position":[-8,0,8],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_07_floor","kind":"floor","position":[-8,0,24],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_08_floor","kind":"floor","position":[8,0,-24],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_09_floor","kind":"floor","position":[8,0,-8],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_10_floor","kind":"floor","position":[8,0,8],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_11_floor","kind":"floor","position":[8,0,24],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_12_floor","kind":"floor","position":[24,0,-24],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_13_floor","kind":"floor","position":[24,0,-8],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_14_floor","kind":"floor","position":[24,0,8],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_15_floor","kind":"floor","position":[24,0,24],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"tr_16_wall","kind":"wall","position":[-24,2,-32],"rotation":[0,0,0],"scale":[4,1.2,1]},
      {"id":"tr_17_wall","kind":"wall","position":[-24,2,32],"rotation":[0,0,0],"scale":[4,1.2,1]},
      {"id":"tr_18_wall","kind":"wall","position":[-8,2,-32],"rotation":[0,0,0],"scale":[4,1.2,1]},
      {"id":"tr_19_wall","kind":"wall","position":[-8,2,32],"rotation":[0,0,0],"scale":[4,1.2,1]},
      {"id":"tr_20_wall","kind":"wall","position":[8,2,-32],"rotation":[0,0,0],"scale":[4,1.2,1]},
      {"id":"tr_21_wall","kind":"wall","position":[8,2,32],"rotation":[0,0,0],"scale":[4,1.2,1]},
      {"id":"tr_22_wall","kind":"wall","position":[24,2,-32],"rotation":[0,0,0],"scale":[4,1.2,1]},
      {"id":"tr_23_wall","kind":"wall","position":[24,2,32],"rotation":[0,0,0],"scale":[4,1.2,1]},
      {"id":"tr_24_wall","kind":"wall","position":[-32,2,-24],"rotation":[0,1.5707963267948966,0],"scale":[4,1.2,1]},
      {"id":"tr_25_wall","kind":"wall","position":[32,2,-24],"rotation":[0,1.5707963267948966,0],"scale":[4,1.2,1]},
      {"id":"tr_26_wall","kind":"wall","position":[-32,2,-8],"rotation":[0,1.5707963267948966,0],"scale":[4,1.2,1]},
      {"id":"tr_27_wall","kind":"wall","position":[32,2,-8],"rotation":[0,1.5707963267948966,0],"scale":[4,1.2,1]},
      {"id":"tr_28_wall","kind":"wall","position":[-32,2,8],"rotation":[0,1.5707963267948966,0],"scale":[4,1.2,1]},
      {"id":"tr_29_wall","kind":"wall","position":[32,2,8],"rotation":[0,1.5707963267948966,0],"scale":[4,1.2,1]},
      {"id":"tr_30_wall","kind":"wall","position":[-32,2,24],"rotation":[0,1.5707963267948966,0],"scale":[4,1.2,1]},
      {"id":"tr_31_wall","kind":"wall","position":[32,2,24],"rotation":[0,1.5707963267948966,0],"scale":[4,1.2,1]},
      {"id":"tr_32_wall","kind":"wall","position":[-12,1.4,-10],"rotation":[0,0.4,0],"scale":[1.5,0.8,1]},
      {"id":"tr_33_wall","kind":"wall","position":[12,1.4,10],"rotation":[0,0.4,0],"scale":[1.5,0.8,1]},
      {"id":"tr_34_wall","kind":"wall","position":[-10,1.4,12],"rotation":[0,-1.2,0],"scale":[1.5,0.8,1]},
      {"id":"tr_35_wall","kind":"wall","position":[10,1.4,-12],"rotation":[0,-1.2,0],"scale":[1.5,0.8,1]},
      {"id":"tr_36_elevated_platform","kind":"elevated_platform","position":[-25,2,0],"rotation":[0,0,0],"scale":[1.4,1,1.4]},
      {"id":"tr_37_ramp","kind":"ramp","position":[-19.5,1.2,0],"rotation":[0,-1.5707963267948966,0],"scale":[1,1,1]},
      {"id":"tr_38_elevated_platform","kind":"elevated_platform","position":[25,2,0],"rotation":[0,0,0],"scale":[1.4,1,1.4]},
      {"id":"tr_39_ramp","kind":"ramp","position":[19.5,1.2,0],"rotation":[0,1.5707963267948966,0],"scale":[1,1,1]},
      {"id":"tr_40_barrel","kind":"barrel","position":[-8,0.9,-5],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"tr_41_barrel","kind":"barrel","position":[7,0.9,6],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"tr_42_cover","kind":"cover","position":[-4,0.75,3],"rotation":[0,0.5,0],"scale":[1,1,1]},
      {"id":"tr_43_cover","kind":"cover","position":[5,0.75,-4],"rotation":[0,-0.4,0],"scale":[1,1,1]},
      {"id":"tr_44_crate","kind":"crate","position":[0,0.9,8],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"tr_45_crate","kind":"crate","position":[-1.5,0.9,-8],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"tr_46_barrel","kind":"barrel","position":[-6,0.9,22],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"tr_47_obstacle","kind":"obstacle","position":[6,1.2,21],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"tr_48_barrel","kind":"barrel","position":[6,0.9,-22],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"tr_49_obstacle","kind":"obstacle","position":[-6,1.2,-21],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"tr_50_team_spawn","kind":"team_spawn","position":[-6,0.3,26],"rotation":[0,0,0],"scale":[1,1,1],"settings":{"team":"A"}},
      {"id":"tr_51_team_spawn","kind":"team_spawn","position":[0,0.3,26],"rotation":[0,0,0],"scale":[1,1,1],"settings":{"team":"A"}},
      {"id":"tr_52_team_spawn","kind":"team_spawn","position":[6,0.3,26],"rotation":[0,0,0],"scale":[1,1,1],"settings":{"team":"A"}},
      {"id":"tr_53_team_spawn","kind":"team_spawn","position":[-6,0.3,-26],"rotation":[0,3.141592653589793,0],"scale":[1,1,1],"settings":{"team":"B"}},
      {"id":"tr_54_team_spawn","kind":"team_spawn","position":[0,0.3,-26],"rotation":[0,3.141592653589793,0],"scale":[1,1,1],"settings":{"team":"B"}},
      {"id":"tr_55_team_spawn","kind":"team_spawn","position":[6,0.3,-26],"rotation":[0,3.141592653589793,0],"scale":[1,1,1],"settings":{"team":"B"}},
      {"id":"tr_56_pickup_weapon","kind":"pickup_weapon","position":[-2,0.6,0],"rotation":[0,0,0],"scale":[1,1,1],"settings":{"weapon":"ak"}},
      {"id":"tr_57_pickup_weapon","kind":"pickup_weapon","position":[2,0.6,0],"rotation":[0,0,0],"scale":[1,1,1],"settings":{"weapon":"m4"}},
      {"id":"tr_58_pickup_ammo","kind":"pickup_ammo","position":[-14,0.45,0],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"tr_59_pickup_ammo","kind":"pickup_ammo","position":[14,0.45,0],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"tr_60_pickup_health","kind":"pickup_health","position":[0,0.5,20],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"tr_61_pickup_health","kind":"pickup_health","position":[0,0.5,-20],"rotation":[0,0,0],"scale":[1,1,1]},
    ],
    spawn_points: [],
    lighting: {"preset":"forest","intensity":1},
    map_config: null, // rebuilt by normalizeMap on first save
    published: true,
    test_mode: false,
    created_at: 1782700000000,
    updated_at: 1782700000000,
    stats: {"plays":0,"total_kills":0,"verified_kills":0,"unique_verified_players":0},
    reward_stats: {"creator_points":0},
    verified_players: [],
    abuse: {"score":100,"flagged":false,"locked":false},
  },
  "map_bear_creek": {
    map_id: "map_bear_creek",
    creator: "BULLSTRIKE",
    creator_username: "BULLSTRIKE",
    title: "Bear Creek Crossing",
    description: "System map — a tight ravine at dusk. One chokepoint in the middle, cover on both banks, and an SMG for whoever gets there first.",
    thumbnail: null,
    objects: [
      {"id":"bc_00_floor","kind":"floor","position":[-16,0,0],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"bc_01_floor","kind":"floor","position":[0,0,0],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"bc_02_floor","kind":"floor","position":[16,0,0],"rotation":[0,0,0],"scale":[2,1,2]},
      {"id":"bc_03_wall","kind":"wall","position":[-16,2.15,-8],"rotation":[0,0,0],"scale":[4,1.3,1]},
      {"id":"bc_04_wall","kind":"wall","position":[-16,2.15,8],"rotation":[0,0,0],"scale":[4,1.3,1]},
      {"id":"bc_05_wall","kind":"wall","position":[0,2.15,-8],"rotation":[0,0,0],"scale":[4,1.3,1]},
      {"id":"bc_06_wall","kind":"wall","position":[0,2.15,8],"rotation":[0,0,0],"scale":[4,1.3,1]},
      {"id":"bc_07_wall","kind":"wall","position":[16,2.15,-8],"rotation":[0,0,0],"scale":[4,1.3,1]},
      {"id":"bc_08_wall","kind":"wall","position":[16,2.15,8],"rotation":[0,0,0],"scale":[4,1.3,1]},
      {"id":"bc_09_wall","kind":"wall","position":[-24,2.15,0],"rotation":[0,1.5707963267948966,0],"scale":[2,1.3,1]},
      {"id":"bc_10_wall","kind":"wall","position":[24,2.15,0],"rotation":[0,1.5707963267948966,0],"scale":[2,1.3,1]},
      {"id":"bc_11_wall","kind":"wall","position":[0,1.7,-4.8],"rotation":[0,1.5707963267948966,0],"scale":[1.6,1,1]},
      {"id":"bc_12_wall","kind":"wall","position":[0,1.7,4.8],"rotation":[0,1.5707963267948966,0],"scale":[1.6,1,1]},
      {"id":"bc_13_crate","kind":"crate","position":[-8,0.9,3],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"bc_14_crate","kind":"crate","position":[8,0.9,-3],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"bc_15_barrel","kind":"barrel","position":[-5,0.9,-4],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"bc_16_barrel","kind":"barrel","position":[5,0.9,4],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"bc_17_cover","kind":"cover","position":[-12,0.75,-2],"rotation":[0,1.5707963267948966,0],"scale":[1,1,1]},
      {"id":"bc_18_cover","kind":"cover","position":[12,0.75,2],"rotation":[0,1.5707963267948966,0],"scale":[1,1,1]},
      {"id":"bc_19_team_spawn","kind":"team_spawn","position":[-21,0.3,-3],"rotation":[0,-1.5707963267948966,0],"scale":[1,1,1],"settings":{"team":"A"}},
      {"id":"bc_20_team_spawn","kind":"team_spawn","position":[-21,0.3,3],"rotation":[0,-1.5707963267948966,0],"scale":[1,1,1],"settings":{"team":"A"}},
      {"id":"bc_21_team_spawn","kind":"team_spawn","position":[21,0.3,-3],"rotation":[0,1.5707963267948966,0],"scale":[1,1,1],"settings":{"team":"B"}},
      {"id":"bc_22_team_spawn","kind":"team_spawn","position":[21,0.3,3],"rotation":[0,1.5707963267948966,0],"scale":[1,1,1],"settings":{"team":"B"}},
      {"id":"bc_23_pickup_weapon","kind":"pickup_weapon","position":[0,0.6,0],"rotation":[0,0,0],"scale":[1,1,1],"settings":{"weapon":"mp5"}},
      {"id":"bc_24_pickup_ammo","kind":"pickup_ammo","position":[-10,0.45,0],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"bc_25_pickup_ammo","kind":"pickup_ammo","position":[10,0.45,0],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"bc_26_pickup_health","kind":"pickup_health","position":[-18,0.5,0],"rotation":[0,0,0],"scale":[1,1,1]},
      {"id":"bc_27_pickup_health","kind":"pickup_health","position":[18,0.5,0],"rotation":[0,0,0],"scale":[1,1,1]},
    ],
    spawn_points: [],
    lighting: {"preset":"dusk","intensity":1},
    map_config: null, // rebuilt by normalizeMap on first save
    published: true,
    test_mode: false,
    created_at: 1782600000000,
    updated_at: 1782600000000,
    stats: {"plays":0,"total_kills":0,"verified_kills":0,"unique_verified_players":0},
    reward_stats: {"creator_points":0},
    verified_players: [],
    abuse: {"score":100,"flagged":false,"locked":false},
  },
};

const DEFAULT_DB = {
  // Published + draft FPS maps, keyed by map_id.
  maps: SEED_MAPS,
  // Player profiles keyed by lowercased Solana payout wallet.
  players: {},
  // Match lifecycle records keyed by match_id (server-tracked integrity).
  matches: {},
  // Append-only kill log (counted AND rejected, for audit + anti-farm history).
  kills: [],
  // Internal reward ledger keyed by wallet: accrued points + claimed totals.
  // NEVER pay every kill on-chain — points accrue here and are claimed in batches.
  ledger: {},
  // Recorded transactions (claims, payouts) with optional on-chain signatures.
  transactions: [],
  // Anti-farm / admin suspicious-activity log.
  flags: [],
  // Reward Ledger Settlement schedule (timestamps in ms).
  settlement: { last: 0, next: 0 },
  // Reward-pipeline debug snapshots (last PvP/NPC/accepted/rejected kill).
  debug: {},
  // Treasury wallet is the source of ALL creator reward settlements. total_paid =
  // lifetime SOL paid to creators (transparency). rewards kept for back-compat (unused).
  treasury: { balance: 0, rewards: 0, total_paid: 0 },
};

let cache = null;
let backend = null;

// ---------- file backend (local dev) ----------
function fileBackend() {
  const ensure = () => {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  };
  return {
    name: "file",
    async load() {
      ensure();
      if (!fs.existsSync(DB_PATH)) return structuredClone(DEFAULT_DB);
      try {
        return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
      } catch {
        return structuredClone(DEFAULT_DB);
      }
    },
    async persist(db) {
      ensure();
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    },
  };
}

// ---------- postgres backend (production) ----------
async function pgBackend(databaseUrl) {
  const pg = (await import("pg")).default;
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    // Managed Postgres (Neon/Supabase/Render) requires SSL.
    ssl: { rejectUnauthorized: false },
    max: 4,
  });
  await pool.query(`CREATE TABLE IF NOT EXISTS bullstrike_state (id text PRIMARY KEY, data jsonb NOT NULL)`);
  return {
    name: "postgres",
    async load() {
      const r = await pool.query(`SELECT data FROM bullstrike_state WHERE id = 'db'`);
      return r.rows[0]?.data ?? structuredClone(DEFAULT_DB);
    },
    async persist(db) {
      await pool.query(
        `INSERT INTO bullstrike_state (id, data) VALUES ('db', $1::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = $1::jsonb`,
        [JSON.stringify(db)]
      );
    },
  };
}

/** Initialise the backend and load the DB into memory. Call once before listen(). */
export async function init() {
  const databaseUrl = process.env.DATABASE_URL || "";
  backend = databaseUrl ? await pgBackend(databaseUrl) : fileBackend();
  cache = await backend.load();
  await backend.persist(cache); // ensure row/file exists so first writes are upserts
  return backend.name;
}

export function read() {
  if (!cache) throw new Error("db not initialised — call init() first");
  // Backfill any top-level keys missing from older persisted snapshots so handlers
  // never crash on `Object.values(undefined)`.
  if (!cache.maps) cache.maps = {};
  if (!cache.players) cache.players = {};
  if (!cache.matches) cache.matches = {};
  if (!Array.isArray(cache.kills)) cache.kills = [];
  if (!cache.ledger) cache.ledger = {};
  if (!Array.isArray(cache.transactions)) cache.transactions = [];
  if (!Array.isArray(cache.flags)) cache.flags = [];
  if (!cache.settlement) cache.settlement = { last: 0, next: 0 };
  if (!cache.treasury) cache.treasury = { balance: 0, rewards: 0, total_paid: 0 };
  if (typeof cache.treasury.total_paid !== "number") cache.treasury.total_paid = 0;
  if (!cache.debug) cache.debug = {}; // reward-pipeline debug snapshots
  return cache;
}

// Tracks the result of the most recent persist (for the reward debug endpoint).
let lastWrite = { ok: null, at: 0, error: null, backend: null };
export function writeStatus() {
  return { ...lastWrite, backend: backend?.name || null };
}

/**
 * Durable write: updates the in-memory cache AND awaits the backend persist, so a
 * route only responds after the data is safely stored. A transient persist error is
 * logged (not thrown) so the request never hangs; the cache re-persists next write.
 */
export async function write(db) {
  cache = db;
  try {
    await backend.persist(db);
    lastWrite = { ok: true, at: Date.now(), error: null, backend: backend?.name };
  } catch (e) {
    lastWrite = { ok: false, at: Date.now(), error: e.message, backend: backend?.name };
    console.error("[db] persist failed (will retry on next write/flush):", e.message);
  }
}

/** Force a save (used on shutdown). */
export async function flush() {
  if (backend && cache) {
    try {
      await backend.persist(cache);
    } catch (e) {
      console.error("[db] flush failed:", e.message);
    }
  }
}
