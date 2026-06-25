import http from "http";
import express from "express";
import cors from "cors";
import { read, write, init, flush, writeStatus } from "./db.js";
import { ANTIFARM, REWARD_MODE, uid, fakeTxHash } from "./antifarm.js";
import { recordValidatedKill, rewardsView, settle, treasuryStats, REWARD } from "./rewards.js";
import { initRealtime, getRoomCounts } from "./realtime.js";
import {
  sendPayout,
  getTokenBalance,
  getSolBalance,
  isValidPublicKey,
  solanaConfig,
  logStartup,
  MIN_TOKENS,
} from "./solana.js";

const app = express();
app.set("trust proxy", true); // so req.ip reflects the real client behind Render's proxy

const MAX_PLAYERS = Number(process.env.MAX_PLAYERS || 16);
const VERIFY_CACHE_MS = Number(process.env.VERIFY_CACHE_MS) || 5 * 60 * 1000;
const ADMIN_SECRET = (process.env.ADMIN_SECRET || "").trim(); // protects /api/admin/*

const SOLANA_CLUSTER = process.env.SOLANA_CLUSTER || "mainnet-beta";
const SOLSCAN_CLUSTER = process.env.SOLSCAN_CLUSTER || (SOLANA_CLUSTER === "mainnet-beta" ? "mainnet" : SOLANA_CLUSTER);

// ---- CORS ----
const DEV_ORIGINS = [];
for (const host of ["localhost", "127.0.0.1"]) {
  // Vite auto-bumps when ports are busy; allow a generous local range + preview.
  for (const port of [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 4173]) {
    DEV_ORIGINS.push(`http://${host}:${port}`);
  }
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

// Local-dev default is 9001 (Boss.fun/course-fun owns 8787). Render overrides via PORT.
const PORT = process.env.PORT || 9001;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const trim = (s) => (typeof s === "string" ? s.trim() : "");

/** Record a transaction and, for outbound types, perform the real on-chain transfer. */
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
    devVerifyOff: solanaConfig.disableTokenVerification,
    onchain: solanaConfig.treasuryLive,
    rpcConfigured: solanaConfig.rpcConfigured,
    treasuryWallet: solanaConfig.treasuryPublicKey,
    rewardsWallet: solanaConfig.rewardsPublicKey,
    maxPlayers: MAX_PLAYERS,
    currency: "SOL",
    rewardMode: REWARD_MODE,
    creatorSelfFarmBypass: REWARD_MODE === "testing", // creator can test on own map in testing
    rewardPerKill: REWARD.PER_KILL, // SOL
    settlementIntervalMs: REWARD.SETTLEMENT_MS,
    dailyCreatorCap: REWARD.DAILY_CAP, // SOL
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

// Treasury transparency. Creator rewards are paid FROM the treasury wallet (all SOL).
app.get("/api/treasury", async (_req, res) => {
  const db = read();
  const stats = treasuryStats(db);
  const onchainBalance = await getSolBalance(solanaConfig.treasuryPublicKey); // real SOL or null (MOCK)
  res.json({
    currency: "SOL",
    treasuryWallet: solanaConfig.treasuryPublicKey, // pays creator rewards
    treasuryBalance: onchainBalance, // on-chain SOL (null in MOCK / no RPC)
    pendingRewards: stats.pending, // SOL owed to creators, awaiting settlement
    totalPaid: stats.total_paid, // lifetime SOL paid to creators
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
    player.dev_bypass = !!result.devBypass;
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

  await write(db);
  res.json(player);
  // Best-effort verification in the BACKGROUND — never block (or fail) registration on
  // the RPC. The client also calls /api/players/verify explicitly.
  if (!existing || !player.verified) {
    verifyPlayer(db, player).then(() => write(db)).catch((e) => console.warn("[verify] background register-verify failed:", e.message));
  }
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

function withLive(m, counts) {
  return { ...m, active_players: counts[m.map_id] || 0, max_players: MAX_PLAYERS };
}

app.get("/api/maps", (req, res) => {
  const db = read();
  const counts = getRoomCounts();
  let maps = Object.values(db.maps);
  if (req.query.creator) maps = maps.filter((m) => m.creator === req.query.creator);
  if (req.query.published !== undefined) maps = maps.filter((m) => m.published === (req.query.published === "true"));
  res.json(sortMaps(maps, req.query.sort).map((m) => withLive(m, counts)));
});

// Live room counts for the match browser / loading screen.
app.get("/api/rooms", (_req, res) => res.json({ counts: getRoomCounts(), maxPlayers: MAX_PLAYERS }));

app.get("/api/maps/:id", (req, res) => {
  const db = read();
  const map = db.maps[req.params.id];
  if (!map) return res.status(404).json({ error: "not found" });
  res.json(withLive(map, getRoomCounts()));
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
// Kills: validate a PvP kill and accrue Creator Reward Ledger activity. NPC/test
// kills never count (victim isn't a registered verified player). Never pays here —
// the ledger settles on a 5-minute schedule.
// ---------------------------------------------------------------------------
app.post("/api/kills/record", async (req, res) => {
  const db = read();
  const body = req.body || {};
  const match = db.matches[body.match_id];
  const map = db.maps[body.map_id || match?.map_id];
  const killer = db.players[trim(body.killer)] || null;
  const victim = db.players[trim(body.victim)] || null;

  const result = recordValidatedKill(db, {
    map, match, killer, victim, weapon: trim(body.weapon) || "m4", head: !!body.head,
    killerIp: req.ip, victimIp: body.victim_ip || null,
    fire_rate: body.fire_rate, accuracy: body.accuracy, killer_distance: body.killer_distance, time_since_spawn_ms: body.time_since_spawn_ms,
  });
  await write(db);
  res.json({ counted: result.counted, reasons: result.reasons, score: result.score, credited: result.credited, kill: result.kill });
});

// ---------------------------------------------------------------------------
// Creator Reward Ledger view. Creators do NOT claim manually — the ledger settles
// on a 5-minute schedule (see settlement loop). This endpoint is read-only.
// ---------------------------------------------------------------------------
function activeMatchesFor(db, wallet) {
  const counts = getRoomCounts();
  return Object.values(db.maps).filter((m) => m.creator === wallet && (counts[m.map_id] || 0) > 0).length;
}

// Admin/debug reward visibility (defined BEFORE :wallet so "debug" isn't a wallet).
app.get("/api/rewards/debug", async (_req, res) => {
  const db = read();
  const counted = db.kills.filter((k) => k.counted);
  const rejected = db.kills.filter((k) => !k.counted);
  const rejectionReasons = {};
  for (const k of rejected) for (const r of k.reasons || []) rejectionReasons[r] = (rejectionReasons[r] || 0) + 1;
  const uniquePlayers = new Set();
  for (const L of Object.values(db.ledger)) for (const w of L.unique_players || []) uniquePlayers.add(w);
  const treasuryBalance = await getSolBalance(solanaConfig.treasuryPublicKey);
  const rewardsWalletBalance = await getSolBalance(solanaConfig.rewardsPublicKey);
  const lastPayoutTx = db.transactions.find((t) => t.type === "settlement" || t.type === "settlement_failed") || null;
  const dbg = db.debug || {};
  const sw = settlementState();

  res.json({
    rewardMode: REWARD_MODE,
    currency: "SOL",
    rewardPerKill: REWARD.PER_KILL,
    settlementIntervalMs: REWARD.SETTLEMENT_MS,

    // last kill snapshots (exact pipeline visibility)
    lastPvpKill: dbg.lastPvpKill || null,
    lastNpcKill: dbg.lastNpcKill || null,
    lastAcceptedReward: dbg.lastAccepted || null,
    lastRejectedReward: dbg.lastRejected || null,
    lastRejectionReason: dbg.lastRejectionReason || null,

    // ledger
    pendingByCreator: Object.values(db.ledger).map((L) => ({
      wallet: L.wallet, pending: L.pending, lifetime_settled: L.lifetime_settled, last_settlement: L.last_settlement || 0,
      validated_kills: L.validated_kills, unique_players_today: (L.unique_players || []).length, flagged: !!L.flagged,
    })),
    pendingLedgerEntries: Object.values(db.ledger).filter((L) => L.pending > 0).map((L) => ({ wallet: L.wallet, pending: L.pending })),
    validatedKills: counted.length,
    rejectedKills: rejected.length,
    rejectionReasons,
    uniquePlayers: uniquePlayers.size,
    recentKills: db.kills.slice(-25).reverse().map((k) => ({
      killer: k.killer, victim: k.victim || "(npc/unregistered)", creator: k.creator,
      counted: k.counted, weapon: k.weapon, head: k.head, reasons: k.reasons, score: k.score, timestamp: k.timestamp,
    })),

    // settlement
    nextSettlementMs: Math.max(0, (db.settlement?.next || 0) - Date.now()),
    lastSettlementAttempt: db.settlement?.last_attempt || null,
    lastSettlementCount: db.settlement?.settled_count ?? null,
    lastPayoutTransaction: lastPayoutTx,
    lastTransactionSignature: db.settlement?.last_signature || null,
    lastPayoutError: db.settlement?.last_error || null,
    failedPayouts: db.transactions.filter((t) => t.type === "settlement_failed").slice(0, 25),
    settlementWorkerRunning: sw.workerRunning,
    schedulerRunning: sw.schedulerRunning,

    // infra
    dbWrite: writeStatus(), // { ok, at, error, backend }
    treasuryWallet: solanaConfig.treasuryPublicKey,
    treasuryBalance, // on-chain SOL or null (MOCK)
    rewardsWalletBalance, // on-chain SOL of the dev/admin wallet or null
    onchain: solanaConfig.treasuryLive,
    verifyLive: solanaConfig.verifyLive,
    devVerifyOff: solanaConfig.disableTokenVerification,
    tokenCA: solanaConfig.tokenCA,
    cluster: SOLANA_CLUSTER,

    // Bypass flags active in the current mode (true = check is OFF for testing).
    creatorSelfFarmBypass: REWARD_MODE === "testing",
    sameIpCheckBypass: REWARD_MODE === "testing",
    antifarmThresholds: {
      spawnProtectionMs: ANTIFARM.SPAWN_PROTECTION_MS,
      minMatchMs: ANTIFARM.MIN_MATCH_MS,
      pairCooldownMs: ANTIFARM.PAIR_COOLDOWN_MS,
      pairDailyCap: ANTIFARM.PAIR_DAILY_CAP,
      minKillerDistance: ANTIFARM.MIN_KILLER_DISTANCE,
      creatorMinUniquePlayers: ANTIFARM.CREATOR_MIN_UNIQUE_PLAYERS,
      creatorMinVerifiedKills: ANTIFARM.CREATOR_MIN_VERIFIED_KILLS,
      creatorSelfFarmCheck: REWARD_MODE === "launch" ? "enabled" : "bypassed (testing)",
      sameIpDeviceCheck: REWARD_MODE === "launch" ? "enabled" : "bypassed (testing)",
      sameWalletCheck: "enabled (always)",
      npcKillsPay: "0 SOL (always)",
    },
  });
});

// ---------------------------------------------------------------------------
// Admin: force an immediate settlement (testing). Protected by ADMIN_SECRET
// (Authorization: Bearer <ADMIN_SECRET>). Disabled if ADMIN_SECRET is unset.
// ---------------------------------------------------------------------------
function adminAuthorized(req) {
  if (!ADMIN_SECRET) return false; // disabled until a secret is configured
  const auth = (req.headers.authorization || "").trim();
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const headerKey = (req.headers["x-admin-secret"] || "").toString().trim();
  return bearer === ADMIN_SECRET || headerKey === ADMIN_SECRET;
}

app.post("/api/admin/force-settlement", async (req, res) => {
  if (!ADMIN_SECRET) return res.status(403).json({ success: false, error: "force-settlement disabled: set ADMIN_SECRET on the server" });
  if (!adminAuthorized(req)) return res.status(401).json({ success: false, error: "unauthorized: provide Authorization: Bearer <ADMIN_SECRET>" });

  const before = treasuryStats(read()).pending;
  console.log(`[Reward] FORCE SETTLEMENT requested (admin) — pending before: ${before} SOL`);
  const r = await runSettlement("force-admin");
  const db = read();
  const after = treasuryStats(db).pending;
  res.json({
    success: !r.error && (r.results || []).every((x) => x.ok !== false) ,
    rewardMode: REWARD_MODE,
    creatorsProcessed: r.settled || 0,
    amountPaid: r.paid || 0,
    currency: "SOL",
    results: r.results || [],
    lastTxSignature: r.lastSignature || db.settlement?.last_signature || null,
    payoutErrors: (r.results || []).filter((x) => x.ok === false).map((x) => ({ wallet: x.wallet, amount: x.amount, error: x.error })),
    treasuryWallet: solanaConfig.treasuryPublicKey,
    onchain: solanaConfig.treasuryLive,
    pendingBefore: before,
    pendingAfter: after,
    error: r.error || null,
  });
});

app.get("/api/rewards/:wallet", (req, res) => {
  const db = read();
  res.json(rewardsView(db, trim(req.params.wallet), activeMatchesFor(db, trim(req.params.wallet))));
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

// ---------------------------------------------------------------------------
// Reward Ledger Settlement — every SETTLEMENT_MS, validate pending balances and
// move pending -> settled (paying on-chain in LIVE mode). The ledger is the source
// of truth; this is the only place rewards leave the ledger.
// ---------------------------------------------------------------------------
let settling = false; // worker currently running
let schedulerRunning = false; // 5-min scheduler active
export function settlementState() {
  return { workerRunning: settling, schedulerRunning };
}
async function runSettlement(trigger = "scheduler") {
  if (settling) {
    console.log(`[Reward] Settlement skipped (${trigger}) — worker already running`);
    return { settled: 0, paid: 0, results: [], skipped: true };
  }
  settling = true;
  try {
    console.log(`[Reward] Settlement scheduler tick (${trigger})`);
    const db = read();
    const r = await settle(db, (args) => tx(db, args));
    await write(db);
    return r;
  } catch (e) {
    console.error("[Reward] Settlement error:", e.message);
    return { settled: 0, paid: 0, results: [], error: e.message };
  } finally {
    settling = false;
  }
}

const server = http.createServer(app);
initRealtime(server, [...ALLOWED_ORIGINS]);

init()
  .then((mode) => {
    const db = read();
    db.settlement = { last: Date.now(), next: Date.now() + REWARD.SETTLEMENT_MS };
    server.listen(PORT, () => {
      console.log(`[killmaps] server on http://localhost:${PORT}`);
      console.log(`[db] storage backend: ${mode}${mode === "file" ? " (ephemeral — set DATABASE_URL for persistence)" : " (persistent)"}`);
      console.log(`[rewards] mode=${REWARD_MODE} · settlement every ${Math.round(REWARD.SETTLEMENT_MS / 1000)}s · ${REWARD.PER_KILL} SOL/validated kill · daily cap ${REWARD.DAILY_CAP} SOL`);
      console.log(`[rewards] anti-farm: minMatch=${ANTIFARM.MIN_MATCH_MS}ms pairCooldown=${ANTIFARM.PAIR_COOLDOWN_MS}ms unlock=${ANTIFARM.CREATOR_MIN_UNIQUE_PLAYERS}players/${ANTIFARM.CREATOR_MIN_VERIFIED_KILLS}kills`);
      if (REWARD_MODE === "testing") console.log(`[rewards] TESTING bypasses: creator-self-farm OFF, same-IP/device OFF (same-wallet + NPC=0 SOL still enforced; token verification + mainnet ON)`);
      logStartup();
      setInterval(() => runSettlement("scheduler"), REWARD.SETTLEMENT_MS);
      schedulerRunning = true;
      console.log(`[Reward] Settlement scheduler running (every ${Math.round(REWARD.SETTLEMENT_MS / 1000)}s)`);
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
