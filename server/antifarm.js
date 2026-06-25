// Anti-farm / anti-abuse engine. A kill only credits the reward ledger if it passes
// EVERY rule here. This is enforced from day one — without it the reward system is
// trivially farmable. Tunables can be overridden via env where it makes sense.
import { MIN_TOKENS } from "./solana.js";

// REWARD_MODE selects the anti-farm threshold profile. "testing" relaxes the strict
// launch thresholds so rewards are easy to earn while testing — anti-farm stays ON
// (different wallets, no self-farm, cooldowns, movement, IP/device checks all remain).
// Default is "launch" (strict). Set REWARD_MODE=testing to relax for testing.
export const REWARD_MODE = (process.env.REWARD_MODE || "launch").toLowerCase() === "testing" ? "testing" : "launch";

const PROFILES = {
  testing: { SPAWN_PROTECTION_MS: 2000, MIN_MATCH_MS: 10000, PAIR_COOLDOWN_MS: 10000, PAIR_DAILY_CAP: 20, MIN_KILLER_DISTANCE: 10, CREATOR_MIN_UNIQUE_PLAYERS: 1, CREATOR_MIN_VERIFIED_KILLS: 1 },
  launch: { SPAWN_PROTECTION_MS: 3000, MIN_MATCH_MS: 60000, PAIR_COOLDOWN_MS: 60000, PAIR_DAILY_CAP: 10, MIN_KILLER_DISTANCE: 40, CREATOR_MIN_UNIQUE_PLAYERS: 3, CREATOR_MIN_VERIFIED_KILLS: 3 },
};
const P = PROFILES[REWARD_MODE];
// An explicit env var wins; otherwise the mode profile value is used.
const envNum = (name, fallback) => (process.env[name] != null && process.env[name] !== "" ? Number(process.env[name]) : fallback);

export const ANTIFARM = {
  // Reject kills within this window of the victim's spawn (anti spawn-camp / instant kill).
  SPAWN_PROTECTION_MS: envNum("SPAWN_PROTECTION_MS", envNum("AF_SPAWN_PROTECTION_MS", P.SPAWN_PROTECTION_MS)),
  // A match must last at least this long before any of its kills can count.
  MIN_MATCH_MS: envNum("MIN_MATCH_MS", envNum("AF_MIN_MATCH_MS", P.MIN_MATCH_MS)),
  // Minimum gap between rewarded kills for the SAME killer->victim pair.
  PAIR_COOLDOWN_MS: envNum("PAIR_COOLDOWN_MS", envNum("AF_PAIR_COOLDOWN_MS", P.PAIR_COOLDOWN_MS)),
  // Max rewarded kills for the same killer->victim pair per rolling 24h.
  PAIR_DAILY_CAP: envNum("PAIR_DAILY_CAP", envNum("AF_PAIR_DAILY_CAP", P.PAIR_DAILY_CAP)),
  // Killer must have moved at least this far (world units) in the match.
  MIN_KILLER_DISTANCE: envNum("MIN_KILLER_DISTANCE", envNum("AF_MIN_KILLER_DISTANCE", P.MIN_KILLER_DISTANCE)),
  // Physically impossible ceilings — anything above is a cheat/bot signal (mode-independent).
  MAX_FIRE_RATE: envNum("AF_MAX_FIRE_RATE", 20), // shots / sec
  MAX_MOVE_SPEED: envNum("AF_MAX_MOVE_SPEED", 18), // units / sec
  MAX_ACCURACY: envNum("AF_MAX_ACCURACY", 0.98), // sustained hit ratio
  // Creator reward UNLOCK thresholds (per map).
  CREATOR_MIN_UNIQUE_PLAYERS: envNum("CREATOR_MIN_UNIQUE_PLAYERS", envNum("AF_MIN_UNIQUE_PLAYERS", P.CREATOR_MIN_UNIQUE_PLAYERS)),
  CREATOR_MIN_VERIFIED_KILLS: envNum("CREATOR_MIN_VERIFIED_KILLS", envNum("AF_MIN_VERIFIED_KILLS", P.CREATOR_MIN_VERIFIED_KILLS)),
};

const DAY_MS = 24 * 60 * 60 * 1000;
// Compare wallets by EXACT trimmed string — Solana base58 is case-sensitive, so
// lowercasing could merge two distinct addresses that differ only in case.
const norm = (w) => (w || "").trim();

/** Counted kills for a specific killer->victim pair within the trailing window. */
function pairHistory(db, killer, victim, now, windowMs = DAY_MS) {
  const k = norm(killer);
  const v = norm(victim);
  return db.kills.filter(
    (e) => e.counted && norm(e.killer) === k && norm(e.victim) === v && now - e.timestamp <= windowMs
  );
}

/**
 * Decide whether a kill should credit the reward ledger.
 *   ctx = { map, match, killer (player|null), victim (player|null), event, now }
 *   event fields (client-reported, all optional): time_since_spawn_ms, fire_rate,
 *         move_speed, accuracy, weapon, distance
 * Returns { counted, reasons, score } where score is 0..100 (higher = cleaner).
 */
export function evaluateKill(db, { map, match, killer, victim, event = {}, now = Date.now() }) {
  const reasons = [];

  // ---- map state ----
  if (!map) reasons.push("map not found");
  else {
    if (!map.published) reasons.push("map not published");
    if (map.test_mode) reasons.push("map in test mode");
    if (map.abuse?.locked) reasons.push("map locked for suspicious activity");
  }

  // ---- match integrity ----
  if (!match) reasons.push("match not found");
  else {
    if (match.ended_at && now > match.ended_at + 5000) reasons.push("match already ended");
    if (now - match.started_at < ANTIFARM.MIN_MATCH_MS) reasons.push("match too short");
  }

  // ---- verification: both sides must hold the token ----
  if (!killer) reasons.push("killer not registered");
  else if (!killer.verified || (killer.token_balance || 0) < MIN_TOKENS) reasons.push("killer not verified");
  if (!victim) reasons.push("victim not registered");
  else if (!victim.verified || (victim.token_balance || 0) < MIN_TOKENS) reasons.push("victim not verified");

  // ---- identity / self-farm guards ----
  const kw = norm(killer?.wallet || event.killer);
  const vw = norm(victim?.wallet || event.victim);
  // Same-wallet farming is ALWAYS blocked (both modes).
  if (kw && vw && kw === vw) reasons.push("killer and victim are the same wallet");
  // Creator-self-farm: blocked in LAUNCH mode. In TESTING mode it's bypassed so a
  // creator can verify payouts on their own map without a third wallet.
  const creatorInvolved = !!(map && (kw === norm(map.creator) || vw === norm(map.creator)));
  let selfFarmBypassed = false;
  if (creatorInvolved) {
    if (REWARD_MODE === "launch") reasons.push("creator cannot farm their own map");
    else selfFarmBypassed = true;
  }

  // ---- spawn protection ----
  if (event.time_since_spawn_ms != null && event.time_since_spawn_ms < ANTIFARM.SPAWN_PROTECTION_MS)
    reasons.push("kill too soon after spawn");

  // ---- movement requirement (anti-AFK / anti-static-bot) ----
  const dist = match?.movement?.[kw] ?? event.killer_distance ?? null;
  if (dist != null && dist < ANTIFARM.MIN_KILLER_DISTANCE) reasons.push("killer moved too little");

  // ---- impossible-stat rejection ----
  if (event.fire_rate != null && event.fire_rate > ANTIFARM.MAX_FIRE_RATE) reasons.push("impossible fire rate");
  if (event.move_speed != null && event.move_speed > ANTIFARM.MAX_MOVE_SPEED) reasons.push("impossible move speed");
  if (event.accuracy != null && event.accuracy > ANTIFARM.MAX_ACCURACY) reasons.push("impossible accuracy");

  // ---- pair cooldown + daily cap ----
  if (kw && vw && kw !== vw) {
    const recent = pairHistory(db, kw, vw, now);
    const lastTs = recent.length ? Math.max(...recent.map((e) => e.timestamp)) : 0;
    if (lastTs && now - lastTs < ANTIFARM.PAIR_COOLDOWN_MS) reasons.push("pair cooldown active");
    if (recent.length >= ANTIFARM.PAIR_DAILY_CAP) reasons.push("pair daily cap reached");
  }

  // Cleanliness score: full marks minus a penalty per failed rule.
  const score = Math.max(0, 100 - reasons.length * 20);
  return { counted: reasons.length === 0, reasons: [...new Set(reasons)], score, selfFarmBypassed };
}

/** Whether a map has met the creator reward unlock thresholds and is not locked. */
export function creatorUnlocked(map) {
  const uniq = map.stats?.unique_verified_players || 0;
  const kills = map.stats?.verified_kills || 0;
  return (
    !map.abuse?.locked &&
    uniq >= ANTIFARM.CREATOR_MIN_UNIQUE_PLAYERS &&
    kills >= ANTIFARM.CREATOR_MIN_VERIFIED_KILLS
  );
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function fakeTxHash() {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  return Array.from({ length: 88 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
