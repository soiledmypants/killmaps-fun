// ---------------------------------------------------------------------------
// Creator Reward Ledger + Settlement.
//
// The ledger — NOT individual kills — is the source of truth. Validated player
// activity accrues to a creator's `pending` balance. Every SETTLEMENT_MS the server
// validates and moves pending -> settled (and pays on-chain in LIVE mode). Direct
// per-kill payouts are never used. All activity is server-validated and anti-farmed.
// ---------------------------------------------------------------------------
import { evaluateKill, uid } from "./antifarm.js";
import { sendPayout, isValidPublicKey } from "./solana.js";

export const REWARD = {
  PER_KILL: Number(process.env.REWARD_PER_KILL || 1), // $ per validated PvP kill
  PER_UNIQUE: Number(process.env.REWARD_PER_UNIQUE || 0.1), // $ per unique player / day
  PER_MINUTE: Number(process.env.REWARD_PER_MINUTE || 0.02), // $ per qualified active minute
  DAILY_CAP: Number(process.env.DAILY_CREATOR_CAP || 500), // $ pending / day / creator
  SETTLEMENT_MS: Number(process.env.SETTLEMENT_MS || 5 * 60 * 1000),
};

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
  L.pending = +(L.pending + add).toFixed(4);
  L.daily_pending = +(L.daily_pending + add).toFixed(4);
  return add;
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

  // Extra PvP-only / alt-farm guards beyond evaluateKill.
  if (killerIp && victimIp && killerIp === victimIp) verdict.reasons.push("same network/device");
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

  return { counted, reasons: kill.reasons, score: verdict.score, kill, credited };
}

/**
 * Reward Ledger Settlement: validate pending balances and move pending -> settled.
 * In LIVE mode (rewards/treasury wallet configured) this also pays the creator on-chain.
 * Returns the number of creators settled.
 */
export async function settle(db, recordTx) {
  let settled = 0;
  for (const L of Object.values(db.ledger)) {
    if (L.flagged || !(L.pending > 0)) continue;
    if (!isValidPublicKey(L.wallet)) continue;
    const amount = +L.pending.toFixed(4);
    let tx;
    try {
      tx = await recordTx({ type: "settlement", wallet: L.wallet, amount, source: "rewards", meta: { kind: "creator" } });
    } catch (e) {
      // on-chain settlement failed — keep pending, retry next cycle
      console.error(`[settlement] failed for ${L.wallet}: ${e.message}`);
      continue;
    }
    L.settled = +(L.settled + amount).toFixed(4);
    L.lifetime_settled = +(L.lifetime_settled + amount).toFixed(4);
    L.pending = 0;
    settled += 1;
    db.treasury.rewards = Math.max(0, +(db.treasury.rewards - amount).toFixed(4));
    void tx;
  }
  db.settlement = { last: Date.now(), next: Date.now() + REWARD.SETTLEMENT_MS };
  return settled;
}

export function rewardsView(db, wallet, activeMatches = 0) {
  const L = getLedger(db, wallet);
  const next = db.settlement?.next || Date.now() + REWARD.SETTLEMENT_MS;
  const myMaps = Object.values(db.maps).filter((m) => m.creator === norm(wallet));
  return {
    wallet: norm(wallet),
    balance: L.settled, // settled "Ledger Balance"
    pending: L.pending, // awaiting next settlement
    lifetime_settled: L.lifetime_settled,
    validated_kills: L.validated_kills,
    unique_players_today: L.unique_players.length,
    activity_score: Math.round(L.activity_score),
    active_matches: activeMatches,
    next_settlement_ms: Math.max(0, next - Date.now()),
    settlement_interval_ms: REWARD.SETTLEMENT_MS,
    daily_cap: REWARD.DAILY_CAP,
    daily_pending: L.daily_pending,
    flagged: !!L.flagged,
    maps: myMaps.map((m) => ({
      map_id: m.map_id, title: m.title,
      validated_kills: m.stats.verified_kills, unique_players: m.stats.unique_verified_players,
      plays: m.stats.plays, total_kills: m.stats.total_kills,
    })),
  };
}
