// ---------------------------------------------------------------------------
// Creator Reward Ledger + Settlement.
//
// The ledger — NOT individual kills — is the source of truth. Validated player
// activity accrues to a creator's `pending` balance. Every SETTLEMENT_MS the server
// validates and moves pending -> settled (and pays on-chain in LIVE mode). Direct
// per-kill payouts are never used. All activity is server-validated and anti-farmed.
// ---------------------------------------------------------------------------
import { evaluateKill, uid, REWARD_MODE } from "./antifarm.js";
import { sendPayout, isValidPublicKey } from "./solana.js";

// All reward values are denominated, stored, and paid in SOL (no USD, no conversion).
// Creator rewards are paid from the TREASURY wallet (see settle() -> source "treasury").
export const CURRENCY = "SOL";
export const REWARD = {
  PER_KILL: Number(process.env.REWARD_PER_KILL || 0.005), // SOL per validated real-player kill (NPC kills = 0)
  PER_UNIQUE: Number(process.env.REWARD_PER_UNIQUE || 0), // off by default — reward is per validated kill
  PER_MINUTE: Number(process.env.REWARD_PER_MINUTE || 0), // off by default
  DAILY_CAP: Number(process.env.DAILY_CREATOR_CAP || 5), // SOL pending / day / creator
  SETTLEMENT_MS: Number(process.env.SETTLEMENT_MS || 5 * 60 * 1000),
};
const round = (n) => Math.round(n * 1e6) / 1e6; // 6-dp SOL precision

const day = () => new Date().toISOString().slice(0, 10);
const norm = (w) => (w || "").trim();

const LEDGER_DEFAULTS = () => ({
  pending: 0, settled: 0, lifetime_settled: 0, validated_kills: 0,
  activity_score: 0, unique_players: [], day: day(), daily_pending: 0, flagged: false,
});

export function getLedger(db, wallet) {
  const w = norm(wallet);
  // Backfill so legacy/partial ledger rows always have the activity-ledger shape.
  const L = { ...LEDGER_DEFAULTS(), ...(db.ledger[w] || {}), wallet: w };
  if (!Array.isArray(L.unique_players)) L.unique_players = [];
  if (typeof L.pending !== "number" || Number.isNaN(L.pending)) L.pending = 0;
  if (typeof L.settled !== "number" || Number.isNaN(L.settled)) L.settled = 0;
  if (L.day !== day()) { L.day = day(); L.daily_pending = 0; L.unique_players = []; }
  db.ledger[w] = L;
  return L;
}

function credit(L, amount) {
  if (amount <= 0 || L.daily_pending >= REWARD.DAILY_CAP) return 0;
  const add = Math.min(amount, REWARD.DAILY_CAP - L.daily_pending);
  L.pending = round(L.pending + add); // SOL
  L.daily_pending = round(L.daily_pending + add);
  return round(add);
}

/** First time a unique verified player generates activity on a creator's map today. */
export function creditUniquePlayer(db, map, playerWallet) {
  if (!map || !playerWallet || playerWallet === map.creator) return;
  const L = getLedger(db, map.creator);
  if (!L.unique_players.includes(playerWallet)) {
    L.unique_players.push(playerWallet);
    L.activity_score += 5;
    credit(L, REWARD.PER_UNIQUE);
    if (!Array.isArray(map.verified_players)) map.verified_players = [];
    if (!map.verified_players.includes(playerWallet)) map.verified_players.push(playerWallet);
    map.stats.unique_verified_players = map.verified_players.length;
  }
}

/** Qualified active minutes played accrue a small creator credit. */
export function creditMinutes(db, map, minutes) {
  if (!map || !(minutes > 0)) return;
  const L = getLedger(db, map.creator);
  L.activity_score += minutes;
  credit(L, REWARD.PER_MINUTE * minutes);
}

/**
 * Validate a PvP kill and, if legitimate, accrue creator reward activity.
 * ctx = { map, match, killer (player), victim (player), weapon, head, killerIp, victimIp }
 * NPC/test kills never reach here as "counted" because the victim isn't a registered
 * verified player. Returns { counted, reasons, score, kill, credited }.
 */
export function recordValidatedKill(db, ctx) {
  const { map, match, killer, victim, weapon, head, killerIp, victimIp } = ctx;
  const now = Date.now();
  const verdict = evaluateKill(db, {
    map, match, killer, victim,
    event: { killer: killer?.wallet, victim: victim?.wallet, weapon, fire_rate: ctx.fire_rate, accuracy: ctx.accuracy, killer_distance: ctx.killer_distance, time_since_spawn_ms: ctx.time_since_spawn_ms },
    now,
  });

  // Extra alt-farm guard: reject kills where killer & victim share an IP/device.
  // ONLY in launch mode — in testing mode two wallets on the same network (same
  // house / Wi-Fi) must be able to validate rewards. Same-WALLET and creator-self-farm
  // are still blocked in BOTH modes (handled in evaluateKill).
  if (REWARD_MODE === "launch" && killerIp && victimIp && killerIp === victimIp) {
    verdict.reasons.push("same network/device");
  }
  const counted = verdict.reasons.length === 0;

  const kill = {
    id: uid("kill"), match_id: match?.match_id || null, map_id: map?.map_id || null,
    creator: map?.creator || null, killer: norm(killer?.wallet), victim: norm(victim?.wallet),
    weapon: weapon || "m4", head: !!head, timestamp: now, counted, reasons: [...new Set(verdict.reasons)], score: verdict.score,
  };
  db.kills.push(kill);
  if (db.kills.length > 50000) db.kills.splice(0, db.kills.length - 50000);

  if (map) map.stats.total_kills = (map.stats.total_kills || 0) + 1;

  let credited = 0;
  if (counted && map) {
    map.stats.verified_kills = (map.stats.verified_kills || 0) + 1;
    creditUniquePlayer(db, map, kill.killer);
    creditUniquePlayer(db, map, kill.victim);
    const L = getLedger(db, map.creator);
    L.validated_kills += 1;
    L.activity_score += 10;
    credited = credit(L, REWARD.PER_KILL);
    map.reward_stats = map.reward_stats || { creator_points: 0 };
    map.reward_stats.creator_points = (map.reward_stats.creator_points || 0) + 1;
    if (killer) killer.stats.kills = (killer.stats.kills || 0) + 1;
    if (victim) victim.stats.deaths = (victim.stats.deaths || 0) + 1;
  } else if (!counted && verdict.score < 60) {
    db.flags.push({ id: uid("flag"), kill_id: kill.id, map_id: kill.map_id, killer: kill.killer, victim: kill.victim, reasons: kill.reasons, timestamp: now });
    if (db.flags.length > 5000) db.flags.splice(0, db.flags.length - 5000);
  }

  // ---- reward-pipeline debug snapshot + staged logs ----
  const matchMs = match ? now - match.started_at : null;
  const isPvp = !!(killer && victim); // both sides are registered players
  const creatorIsPlayer = !!(map && (kill.killer === norm(map.creator) || kill.victim === norm(map.creator)));
  const summary = {
    killer: kill.killer || null, victim: kill.victim || "(npc/unregistered)", creator: kill.creator || null,
    weapon: kill.weapon, head: kill.head, isPvp, counted, credited, reasons: kill.reasons, score: verdict.score, matchMs,
    sameWallet: !!(kill.killer && kill.killer === kill.victim),
    sameIp: !!(killerIp && victimIp && killerIp === victimIp),
    creatorIsPlayer, selfFarmBypassed: !!verdict.selfFarmBypassed, // testing-only bypass of creator-self-farm
    killerRegistered: !!killer, victimRegistered: !!victim,
    killerVerified: !!(killer && killer.verified), victimVerified: !!(victim && victim.verified),
    killerBalance: killer?.token_balance ?? null, victimBalance: victim?.token_balance ?? null,
    timestamp: now,
  };
  db.debug = db.debug || {};
  db.debug.creatorSelfFarmBypass = REWARD_MODE === "testing"; // current mode flag
  if (isPvp) db.debug.lastPvpKill = summary; else db.debug.lastNpcKill = summary;
  if (counted) db.debug.lastAccepted = summary;
  else { db.debug.lastRejected = summary; db.debug.lastRejectionReason = kill.reasons.join(", "); }

  if (verdict.selfFarmBypassed) console.log(`[Reward] Creator-self-farm check BYPASSED (testing mode) — creator ${kill.creator} is a player on this map`);
  console.log(`[Reward] Kill received: killer=${summary.killer || "?"} victim=${summary.victim} creator=${summary.creator || "?"} weapon=${kill.weapon} head=${kill.head} pvp=${isPvp} matchMs=${matchMs}`);
  if (counted) {
    console.log(`[Reward] Kill validation PASSED — ledger +${credited} SOL credited to creator ${kill.creator} (pending now ${getLedger(db, kill.creator).pending} SOL, validated_kills ${getLedger(db, kill.creator).validated_kills})`);
  } else {
    console.log(`[Reward] Kill validation FAILED: ${kill.reasons.join(", ") || "(no reason?)"} | killerVerified=${summary.killerVerified} victimVerified=${summary.victimVerified} sameWallet=${summary.sameWallet} sameIp=${summary.sameIp} matchMs=${matchMs} score=${verdict.score}`);
  }

  return { counted, reasons: kill.reasons, score: verdict.score, kill, credited };
}

/**
 * Reward Ledger Settlement: validate pending creator balances and pay them out.
 * Creator reward payouts are ALWAYS signed by the TREASURY wallet (source "treasury" =>
 * TREASURY_WALLET_PRIVATE_KEY in solana.js). The Creator-Rewards/dev wallet is NOT used.
 * In LIVE mode this sends real SOL; in MOCK it records the settlement only.
 * Returns the number of creators settled.
 */
export async function settle(db, recordTx) {
  const attemptAt = Date.now();
  let settled = 0;
  let paid = 0;
  let lastError = null;
  let lastSignature = null;
  let lastPayout = null;
  const results = [];
  const candidates = Object.values(db.ledger).filter((L) => !L.flagged && L.pending > 0 && isValidPublicKey(L.wallet));
  console.log(`[Reward] Settlement worker started — ${candidates.length} creator(s) with pending rewards`);

  for (const L of candidates) {
    const amount = round(L.pending); // SOL
    console.log(`[Reward] Sending ${amount} SOL from treasury to creator ${L.wallet}`);
    let tx;
    try {
      // source "treasury" -> signed by TREASURY_WALLET_PRIVATE_KEY
      tx = await recordTx({ type: "settlement", wallet: L.wallet, amount, source: "treasury", meta: { kind: "creator", paid_by: "treasury" } });
    } catch (e) {
      lastError = e.message;
      console.error(`[Reward] Settlement failed for ${L.wallet} (${amount} SOL): ${e.message}`);
      db.transactions.unshift({
        id: uid("tx"), type: "settlement_failed", wallet: L.wallet, amount, points: null,
        status: "failed", onchain: false, timestamp: Date.now(), tx_hash: null, error: e.message, paid_by: "treasury",
      });
      results.push({ wallet: L.wallet, amount, ok: false, error: e.message });
      continue; // KEEP pending — retried next cycle
    }
    L.settled = round(L.settled + amount);
    L.lifetime_settled = round(L.lifetime_settled + amount);
    L.last_settlement = amount;
    L.pending = 0;
    settled += 1;
    paid = round(paid + amount);
    db.treasury.balance = round((db.treasury.balance || 0) - amount);
    db.treasury.total_paid = round((db.treasury.total_paid || 0) + amount);
    lastSignature = tx.tx_hash || null;
    lastPayout = tx;
    if (tx.onchain) console.log(`[Reward] Transaction signature: ${tx.tx_hash}`);
    else console.log(`[Reward] Recorded settlement (MOCK — no on-chain transfer; set TREASURY_WALLET_PRIVATE_KEY + SOLANA_RPC_URL for live payouts)`);
    console.log(`[Reward] Transaction ${tx.onchain ? "confirmed" : "recorded"} — ${amount} SOL to ${L.wallet}`);
    results.push({ wallet: L.wallet, amount, ok: true, onchain: tx.onchain, signature: tx.tx_hash });
  }

  db.settlement = {
    last: attemptAt, last_attempt: attemptAt, last_error: lastError, settled_count: settled,
    last_signature: lastSignature, last_payout: lastPayout, next: Date.now() + REWARD.SETTLEMENT_MS,
  };
  console.log(`[Reward] Settlement complete — settled=${settled} paid=${paid} SOL${lastError ? ` lastError="${lastError}"` : ""}`);
  return { settled, paid, results, lastError, lastSignature };
}

/** Global treasury transparency figures (all SOL). */
export function treasuryStats(db) {
  const pending = round(Object.values(db.ledger).reduce((s, L) => s + (L.pending || 0), 0));
  return {
    pending, // SOL owed to creators, not yet settled
    total_paid: round(db.treasury.total_paid || 0), // lifetime SOL paid to creators
    ledger_balance: round(db.treasury.balance || 0), // internal treasury accounting
    currency: CURRENCY,
  };
}

export function rewardsView(db, wallet, activeMatches = 0) {
  const L = getLedger(db, wallet);
  const next = db.settlement?.next || Date.now() + REWARD.SETTLEMENT_MS;
  const myMaps = Object.values(db.maps).filter((m) => m.creator === norm(wallet));
  return {
    wallet: norm(wallet),
    currency: CURRENCY, // "SOL"
    reward_per_kill: REWARD.PER_KILL, // SOL
    balance: L.settled, // settled lifetime SOL earned
    pending: L.pending, // SOL awaiting next settlement
    lifetime_settled: L.lifetime_settled, // SOL
    last_settlement: L.last_settlement || 0, // SOL of the most recent settlement
    validated_kills: L.validated_kills,
    unique_players_today: L.unique_players.length,
    activity_score: Math.round(L.activity_score),
    active_matches: activeMatches,
    next_settlement_ms: Math.max(0, next - Date.now()),
    settlement_interval_ms: REWARD.SETTLEMENT_MS,
    daily_cap: REWARD.DAILY_CAP, // SOL
    daily_pending: L.daily_pending, // SOL
    flagged: !!L.flagged,
    maps: myMaps.map((m) => ({
      map_id: m.map_id, title: m.title,
      validated_kills: m.stats.verified_kills, unique_players: m.stats.unique_verified_players,
      plays: m.stats.plays, total_kills: m.stats.total_kills,
    })),
  };
}
