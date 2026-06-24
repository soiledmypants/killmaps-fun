import express from "express";
import cors from "cors";
import { read, write, init, flush } from "./db.js";
import { evaluateKill, creatorUnlocked, ANTIFARM, uid, fakeTxHash } from "./antifarm.js";
import {
  sendPayout,
  getTokenBalance,
  isValidPublicKey,
  solanaConfig,
  logStartup,
  MIN_TOKENS,
} from "./solana.js";

const app = express();

// ---- Reward economics (env-overridable) ----
const POINTS_PER_SOL = Number(process.env.REWARD_POINTS_PER_SOL) || 10000;
const CREATOR_POINTS_PER_KILL = Number(process.env.CREATOR_POINTS_PER_KILL) || 10;
const PLAYER_POINTS_PER_KILL = Number(process.env.PLAYER_POINTS_PER_KILL) || 5;
const MIN_CREATOR_CLAIM_POINTS = Number(process.env.MIN_CREATOR_CLAIM_POINTS) || 1000;
const MIN_PLAYER_CLAIM_POINTS = Number(process.env.MIN_PLAYER_CLAIM_POINTS) || 500;
const VERIFY_CACHE_MS = Number(process.env.VERIFY_CACHE_MS) || 5 * 60 * 1000;

const SOLANA_CLUSTER = process.env.SOLANA_CLUSTER || "mainnet-beta";
const SOLSCAN_CLUSTER = process.env.SOLSCAN_CLUSTER || (SOLANA_CLUSTER === "mainnet-beta" ? "mainnet" : SOLANA_CLUSTER);

// ---- CORS ----
const DEV_ORIGINS = [];
for (const host of ["localhost", "127.0.0.1"]) {
  for (const port of [5173, 5174, 5175, 4173]) DEV_ORIGINS.push(`http://${host}:${port}`);
}
const normOrigin = (o) => (o || "").trim().replace(/\/+$/, "");
function envOrigins() {
  return [process.env.FRONTEND_URL, process.env.CORS_ORIGINS]
    .filter(Boolean)
    .flatMap((v) => v.split(","))
    .map(normOrigin)
    .filter(Boolean);
}
const ALLOWED_ORIGINS = new Set(
  [...DEV_ORIGINS, "https://killmaps.netlify.app", ...envOrigins()].filter(Boolean).map(normOrigin)
);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || ALLOWED_ORIGINS.has(normOrigin(origin))) return cb(null, true);
      console.warn(`[cors] blocked origin: ${origin}`);
      return cb(null, false);
    },
  })
);
app.use(express.json({ limit: "12mb" }));

const PORT = process.env.PORT || 8787;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const trim = (s) => (typeof s === "string" ? s.trim() : "");

function getLedger(db, wallet) {
  const w = trim(wallet);
  if (!db.ledger[w]) {
    db.ledger[w] = { wallet: w, creator_points: 0, player_points: 0, creator_claimed: 0, player_claimed: 0 };
  }
  return db.ledger[w];
}

function pointsToSol(points) {
  return Math.floor((points / POINTS_PER_SOL) * 1e6) / 1e6; // 6-dp floor, no over-pay
}

/** Record a transaction and, for reward claims, perform the real on-chain transfer. */
async function tx(db, { type, wallet, amount, points, source, status = "confirmed", meta = {} }) {
  let tx_hash = fakeTxHash();
  let onchain = false;
  if (source) {
    const result = await sendPayout(source, wallet, amount); // throws on real transfer failure
    if (result.onchain) {
      tx_hash = result.signature;
      onchain = true;
    }
  }
  const t = {
    id: uid("tx"),
    type,
    wallet,
    amount,
    points: points ?? null,
    status,
    onchain,
    timestamp: Date.now(),
    tx_hash,
    ...meta,
  };
  db.transactions.unshift(t);
  return t;
}

function normalizeMap(map, existing) {
  const now = Date.now();
  const m = { ...map };
  m.created_at = existing?.created_at || map.created_at || now;
  m.updated_at = now;
  m.published = existing ? existing.published && map.published !== false ? existing.published : !!map.published : !!map.published;
  if (map.published !== undefined) m.published = !!map.published;
  m.test_mode = !!map.test_mode;
  m.objects = Array.isArray(map.objects) ? map.objects : existing?.objects || [];
  m.spawn_points = Array.isArray(map.spawn_points) ? map.spawn_points : existing?.spawn_points || [];
  m.lighting = map.lighting || existing?.lighting || { preset: "indoor", intensity: 1 };
  m.map_config = map.map_config || { objects: m.objects, spawn_points: m.spawn_points, lighting: m.lighting };
  m.stats = existing?.stats || { plays: 0, total_kills: 0, verified_kills: 0, unique_verified_players: 0 };
  m.reward_stats = existing?.reward_stats || { creator_points: 0 };
  m.verified_players = existing?.verified_players || [];
  m.abuse = existing?.abuse || { score: 100, flagged: false, locked: false };
  return m;
}

function publicConfig() {
  return {
    cluster: SOLANA_CLUSTER,
    solscanCluster: SOLSCAN_CLUSTER,
    tokenCA: solanaConfig.tokenCA,
    minTokens: MIN_TOKENS,
    verifyLive: solanaConfig.verifyLive,
    onchain: solanaConfig.treasuryLive,
    rpcConfigured: solanaConfig.rpcConfigured,
    treasuryWallet: solanaConfig.treasuryPublicKey,
    rewardsWallet: solanaConfig.rewardsPublicKey,
    pointsPerSol: POINTS_PER_SOL,
    creatorPointsPerKill: CREATOR_POINTS_PER_KILL,
    playerPointsPerKill: PLAYER_POINTS_PER_KILL,
    minCreatorClaimPoints: MIN_CREATOR_CLAIM_POINTS,
    minPlayerClaimPoints: MIN_PLAYER_CLAIM_POINTS,
    antifarm: {
      spawnProtectionMs: ANTIFARM.SPAWN_PROTECTION_MS,
      minMatchMs: ANTIFARM.MIN_MATCH_MS,
      pairCooldownMs: ANTIFARM.PAIR_COOLDOWN_MS,
      pairDailyCap: ANTIFARM.PAIR_DAILY_CAP,
      creatorMinUniquePlayers: ANTIFARM.CREATOR_MIN_UNIQUE_PLAYERS,
      creatorMinVerifiedKills: ANTIFARM.CREATOR_MIN_VERIFIED_KILLS,
    },
  };
}

// ---------------------------------------------------------------------------
// Config / health
// ---------------------------------------------------------------------------
app.get("/api/config", (_req, res) => res.json(publicConfig()));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/treasury", (_req, res) => {
  const db = read();
  res.json({
    treasury: db.treasury.balance,
    rewards: db.treasury.rewards,
    treasuryWallet: solanaConfig.treasuryPublicKey,
    rewardsWallet: solanaConfig.rewardsPublicKey,
    onchain: solanaConfig.treasuryLive,
    cluster: SOLANA_CLUSTER,
    solscanCluster: SOLSCAN_CLUSTER,
  });
});

// ---------------------------------------------------------------------------
// Players: register + verify (token holding) + profile
// ---------------------------------------------------------------------------
async function verifyPlayer(db, player, { force = false } = {}) {
  const now = Date.now();
  if (!force && player.verified_at && now - player.verified_at < VERIFY_CACHE_MS) {
    return { cached: true };
  }
  const result = await getTokenBalance(player.wallet);
  if (result.ok) {
    player.verified = !!result.verified;
    player.token_balance = result.balance || 0;
    player.verify_mock = !!result.mock;
    player.verified_at = now;
  }
  return result;
}

app.post("/api/players/register", async (req, res) => {
  const db = read();
  const wallet = trim(req.body?.wallet);
  const username = trim(req.body?.username).slice(0, 32) || "player";
  if (!isValidPublicKey(wallet)) return res.status(400).json({ error: "enter a valid Solana payout wallet address" });

  const now = Date.now();
  const existing = db.players[wallet];
  const player = existing || {
    wallet,
    username,
    verified: false,
    token_balance: 0,
    verified_at: 0,
    verify_mock: false,
    stats: { kills: 0, deaths: 0, maps_created: 0 },
    created_at: now,
  };
  player.username = username;
  player.updated_at = now;
  db.players[wallet] = player;

  await verifyPlayer(db, player); // best-effort verification on register
  await write(db);
  res.json(player);
});

app.post("/api/players/verify", async (req, res) => {
  const db = read();
  const wallet = trim(req.body?.wallet);
  if (!isValidPublicKey(wallet)) return res.status(400).json({ error: "valid Solana wallet required" });
  const player = db.players[wallet];
  if (!player) return res.status(404).json({ error: "register first" });

  const result = await verifyPlayer(db, player, { force: !!req.body?.force });
  await write(db);
  res.json({ player, result: { verified: player.verified, balance: player.token_balance, mock: player.verify_mock, ...result } });
});

app.get("/api/players/:wallet", (req, res) => {
  const db = read();
  const player = db.players[trim(req.params.wallet)];
  if (!player) return res.status(404).json({ error: "not found" });
  res.json(player);
});

// ---------------------------------------------------------------------------
// Maps: CRUD + publish + browse
// ---------------------------------------------------------------------------
function sortMaps(maps, sort) {
  const by = {
    trending: (a, b) => (b.stats.verified_kills + b.stats.plays) - (a.stats.verified_kills + a.stats.plays),
    kills: (a, b) => b.stats.verified_kills - a.stats.verified_kills,
    players: (a, b) => b.stats.unique_verified_players - a.stats.unique_verified_players,
    rewards: (a, b) => (b.reward_stats?.creator_points || 0) - (a.reward_stats?.creator_points || 0),
    newest: (a, b) => b.created_at - a.created_at,
  };
  return maps.sort(by[sort] || ((a, b) => b.updated_at - a.updated_at));
}

app.get("/api/maps", (req, res) => {
  const db = read();
  let maps = Object.values(db.maps);
  if (req.query.creator) maps = maps.filter((m) => m.creator === req.query.creator);
  if (req.query.published !== undefined) maps = maps.filter((m) => m.published === (req.query.published === "true"));
  res.json(sortMaps(maps, req.query.sort));
});

app.get("/api/maps/:id", (req, res) => {
  const db = read();
  const map = db.maps[req.params.id];
  if (!map) return res.status(404).json({ error: "not found" });
  res.json(map);
});

app.post("/api/maps", async (req, res) => {
  const db = read();
  const body = req.body || {};
  if (!isValidPublicKey(body.creator)) return res.status(400).json({ error: "valid creator wallet required" });
  const map_id = trim(body.map_id) || uid("map");
  const map = normalizeMap({ ...body, map_id }, db.maps[map_id]);
  db.maps[map_id] = map;
  // bump creator's maps_created count once per new map
  if (!db.maps[map_id]?.counted_created) {
    const p = db.players[map.creator];
    if (p) p.stats.maps_created = (p.stats.maps_created || 0) + 1;
    map.counted_created = true;
  }
  await write(db);
  res.json(map);
});

app.put("/api/maps/:id", async (req, res) => {
  const db = read();
  const existing = db.maps[req.params.id];
  if (!existing) return res.status(404).json({ error: "not found" });
  const map = normalizeMap({ ...req.body, map_id: req.params.id, creator: existing.creator }, existing);
  map.counted_created = existing.counted_created;
  db.maps[req.params.id] = map;
  await write(db);
  res.json(map);
});

app.delete("/api/maps/:id", async (req, res) => {
  const db = read();
  delete db.maps[req.params.id];
  await write(db);
  res.json({ ok: true });
});

app.post("/api/maps/:id/publish", async (req, res) => {
  const db = read();
  const map = db.maps[req.params.id];
  if (!map) return res.status(404).json({ error: "not found" });
  // A publishable map needs at least one spawn point and a floor to stand on.
  const spawns = (map.spawn_points || []).length || (map.objects || []).filter((o) => o.kind === "spawn" || o.kind === "team_spawn").length;
  if (req.body.published && spawns < 1)
    return res.status(400).json({ error: "add at least one spawn point before publishing" });
  map.published = !!req.body.published;
  map.test_mode = false;
  map.updated_at = Date.now();
  await write(db);
  res.json(map);
});

// ---------------------------------------------------------------------------
// Matches: start / event / end (server-tracked integrity)
// ---------------------------------------------------------------------------
app.post("/api/matches/start", async (req, res) => {
  const db = read();
  const { map_id, mode = "ffa", wallet } = req.body || {};
  const map = db.maps[map_id];
  if (!map) return res.status(404).json({ error: "map not found" });
  const match = {
    match_id: uid("match"),
    map_id,
    creator: map.creator,
    mode,
    started_at: Date.now(),
    ended_at: null,
    players: wallet ? [trim(wallet)] : [],
    movement: {},
    events: 0,
    kills: 0,
    valid: true,
  };
  db.matches[match.match_id] = match;
  map.stats.plays = (map.stats.plays || 0) + 1;
  await write(db);
  res.json({ match, map });
});

app.post("/api/matches/:id/event", async (req, res) => {
  const db = read();
  const match = db.matches[req.params.id];
  if (!match) return res.status(404).json({ error: "match not found" });
  const { wallet, distance, joined } = req.body || {};
  const w = trim(wallet);
  if (w) {
    if (!match.players.includes(w)) match.players.push(w);
    if (typeof distance === "number") match.movement[w] = (match.movement[w] || 0) + Math.max(0, distance);
  }
  if (joined && w && !match.players.includes(w)) match.players.push(w);
  match.events += 1;
  await write(db);
  res.json({ ok: true });
});

app.post("/api/matches/:id/end", async (req, res) => {
  const db = read();
  const match = db.matches[req.params.id];
  if (!match) return res.status(404).json({ error: "match not found" });
  match.ended_at = Date.now();
  await write(db);
  res.json({ match });
});

// ---------------------------------------------------------------------------
// Kills: record a kill, run anti-farm, credit the reward ledger if valid.
// NEVER pays on-chain here — points accrue and are claimed in batches later.
// ---------------------------------------------------------------------------
app.post("/api/kills/record", async (req, res) => {
  const db = read();
  const body = req.body || {};
  const match = db.matches[body.match_id];
  const map = db.maps[body.map_id || match?.map_id];
  const killer = db.players[trim(body.killer)] || null;
  const victim = db.players[trim(body.victim)] || null;
  const now = Date.now();

  const verdict = evaluateKill(db, {
    map,
    match,
    killer,
    victim,
    event: {
      killer: body.killer,
      victim: body.victim,
      weapon: body.weapon,
      time_since_spawn_ms: body.time_since_spawn_ms,
      fire_rate: body.fire_rate,
      move_speed: body.move_speed,
      accuracy: body.accuracy,
      killer_distance: body.killer_distance,
    },
    now,
  });

  const kill = {
    id: uid("kill"),
    match_id: body.match_id || null,
    map_id: map?.map_id || null,
    creator: map?.creator || null,
    killer: trim(body.killer),
    victim: trim(body.victim),
    weapon: trim(body.weapon) || "rifle",
    distance: body.distance ?? null,
    timestamp: now,
    counted: verdict.counted,
    reasons: verdict.reasons,
    score: verdict.score,
  };
  db.kills.push(kill);
  if (db.kills.length > 50000) db.kills.splice(0, db.kills.length - 50000); // bound the log

  if (map) {
    map.stats.total_kills = (map.stats.total_kills || 0) + 1;
    if (match) match.kills += 1;
  }

  // Suspicious-but-uncounted kills are logged for admin/debug review.
  if (!verdict.counted && verdict.score < 60) {
    db.flags.push({ id: uid("flag"), kill_id: kill.id, map_id: kill.map_id, killer: kill.killer, victim: kill.victim, reasons: verdict.reasons, timestamp: now });
    if (db.flags.length > 5000) db.flags.splice(0, db.flags.length - 5000);
  }

  if (verdict.counted && map) {
    map.stats.verified_kills = (map.stats.verified_kills || 0) + 1;
    for (const w of [kill.killer, kill.victim]) {
      if (w && !map.verified_players.includes(w)) map.verified_players.push(w);
    }
    map.stats.unique_verified_players = map.verified_players.length;

    // Credit the reward ledger — creator earns from activity, killer earns a small reward.
    getLedger(db, map.creator).creator_points += CREATOR_POINTS_PER_KILL;
    map.reward_stats.creator_points = (map.reward_stats.creator_points || 0) + CREATOR_POINTS_PER_KILL;
    getLedger(db, kill.killer).player_points += PLAYER_POINTS_PER_KILL;

    if (killer) killer.stats.kills = (killer.stats.kills || 0) + 1;
    if (victim) victim.stats.deaths = (victim.stats.deaths || 0) + 1;
  }

  await write(db);
  res.json({ counted: verdict.counted, reasons: verdict.reasons, score: verdict.score, kill });
});

// ---------------------------------------------------------------------------
// Rewards: view ledger + claim (batched, from Treasury / Creator-Rewards wallet)
// ---------------------------------------------------------------------------
function rewardsView(db, wallet) {
  const w = trim(wallet);
  const ledger = db.ledger[w] || { wallet: w, creator_points: 0, player_points: 0, creator_claimed: 0, player_claimed: 0 };
  const myMaps = Object.values(db.maps).filter((m) => m.creator === w);
  const unlocked = myMaps.some(creatorUnlocked);
  const nextMap = myMaps
    .filter((m) => !creatorUnlocked(m))
    .sort((a, b) => b.stats.verified_kills - a.stats.verified_kills)[0];
  return {
    wallet: w,
    creator_points: ledger.creator_points,
    player_points: ledger.player_points,
    creator_claimed: ledger.creator_claimed,
    player_claimed: ledger.player_claimed,
    creator_sol: pointsToSol(ledger.creator_points),
    player_sol: pointsToSol(ledger.player_points),
    creator_unlocked: unlocked,
    points_per_sol: POINTS_PER_SOL,
    min_creator_claim_points: MIN_CREATOR_CLAIM_POINTS,
    min_player_claim_points: MIN_PLAYER_CLAIM_POINTS,
    maps: myMaps.map((m) => ({
      map_id: m.map_id,
      title: m.title,
      verified_kills: m.stats.verified_kills,
      unique_verified_players: m.stats.unique_verified_players,
      creator_points: m.reward_stats?.creator_points || 0,
      unlocked: creatorUnlocked(m),
    })),
    unlock_progress: nextMap
      ? {
          map_id: nextMap.map_id,
          title: nextMap.title,
          players: nextMap.stats.unique_verified_players,
          players_needed: ANTIFARM.CREATOR_MIN_UNIQUE_PLAYERS,
          kills: nextMap.stats.verified_kills,
          kills_needed: ANTIFARM.CREATOR_MIN_VERIFIED_KILLS,
        }
      : null,
  };
}

app.get("/api/rewards/:wallet", (req, res) => {
  const db = read();
  res.json(rewardsView(db, req.params.wallet));
});

app.post("/api/rewards/claim", async (req, res) => {
  const db = read();
  const wallet = trim(req.body?.wallet);
  const type = req.body?.type === "creator" ? "creator" : "player";
  if (!isValidPublicKey(wallet)) return res.status(400).json({ error: "valid Solana payout wallet required" });

  const ledger = getLedger(db, wallet);

  if (type === "creator") {
    const unlocked = Object.values(db.maps).some((m) => m.creator === wallet && creatorUnlocked(m));
    if (!unlocked)
      return res.status(400).json({
        error: `creator rewards unlock at ${ANTIFARM.CREATOR_MIN_UNIQUE_PLAYERS}+ unique verified players and ${ANTIFARM.CREATOR_MIN_VERIFIED_KILLS}+ verified kills on a map`,
      });
    if (ledger.creator_points < MIN_CREATOR_CLAIM_POINTS)
      return res.status(400).json({ error: `need at least ${MIN_CREATOR_CLAIM_POINTS} creator points to claim` });

    const points = ledger.creator_points;
    const amount = pointsToSol(points);
    if (amount <= 0) return res.status(400).json({ error: "nothing to claim yet" });
    let t;
    try {
      t = await tx(db, { type: "creator_reward", wallet, amount, points, source: "rewards", meta: { kind: "creator" } });
    } catch (e) {
      return res.status(502).json({ error: "on-chain reward payout failed: " + e.message });
    }
    ledger.creator_points = 0;
    ledger.creator_claimed += points;
    db.treasury.rewards = Math.max(0, db.treasury.rewards - amount);
    await write(db);
    return res.json({ tx: t, rewards: rewardsView(db, wallet) });
  }

  // player claim
  if (ledger.player_points < MIN_PLAYER_CLAIM_POINTS)
    return res.status(400).json({ error: `need at least ${MIN_PLAYER_CLAIM_POINTS} player points to claim` });
  const points = ledger.player_points;
  const amount = pointsToSol(points);
  if (amount <= 0) return res.status(400).json({ error: "nothing to claim yet" });
  let t;
  try {
    t = await tx(db, { type: "player_reward", wallet, amount, points, source: "treasury", meta: { kind: "player" } });
  } catch (e) {
    return res.status(502).json({ error: "on-chain reward payout failed: " + e.message });
  }
  ledger.player_points = 0;
  ledger.player_claimed += points;
  db.treasury.balance = Math.max(0, db.treasury.balance - amount);
  await write(db);
  res.json({ tx: t, rewards: rewardsView(db, wallet) });
});

// ---------------------------------------------------------------------------
// Transactions + creator leaderboard
// ---------------------------------------------------------------------------
app.get("/api/transactions", (_req, res) => res.json(read().transactions));

app.get("/api/leaderboard", (_req, res) => {
  const db = read();
  const board = {};
  for (const m of Object.values(db.maps)) {
    const c = m.creator;
    board[c] = board[c] || { wallet: c, username: db.players[c]?.username || null, verified_kills: 0, unique_players: 0, maps: 0 };
    board[c].verified_kills += m.stats.verified_kills || 0;
    board[c].unique_players += m.stats.unique_verified_players || 0;
    board[c].maps += 1;
  }
  res.json(Object.values(board).sort((a, b) => b.verified_kills - a.verified_kills));
});

// JSON 404 + error handler (never an HTML stack page).
app.use((req, res) => res.status(404).json({ error: "not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[error]", err?.message || err);
  if (res.headersSent) return;
  res.status(err?.status || 500).json({ error: "Internal server error" });
});

init()
  .then((mode) => {
    app.listen(PORT, () => {
      console.log(`[killmaps] server on http://localhost:${PORT}`);
      console.log(`[db] storage backend: ${mode}${mode === "file" ? " (ephemeral — set DATABASE_URL for persistence)" : " (persistent)"}`);
      logStartup();
    });
  })
  .catch((e) => {
    console.error("[db] init failed:", e);
    process.exit(1);
  });

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => {
    await flush();
    process.exit(0);
  });
}
