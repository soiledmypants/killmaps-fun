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

const DEFAULT_DB = {
  // Published + draft FPS maps, keyed by map_id.
  maps: {},
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
  // Treasury funds player payouts; rewards pool funds creator reward settlements.
  treasury: { balance: 0, rewards: 0 },
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
  await pool.query(`CREATE TABLE IF NOT EXISTS killmaps_state (id text PRIMARY KEY, data jsonb NOT NULL)`);
  return {
    name: "postgres",
    async load() {
      const r = await pool.query(`SELECT data FROM killmaps_state WHERE id = 'db'`);
      return r.rows[0]?.data ?? structuredClone(DEFAULT_DB);
    },
    async persist(db) {
      await pool.query(
        `INSERT INTO killmaps_state (id, data) VALUES ('db', $1::jsonb)
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
  if (!cache.treasury) cache.treasury = { balance: 0, rewards: 0 };
  return cache;
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
  } catch (e) {
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
