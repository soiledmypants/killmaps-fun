// ---------------------------------------------------------------------------
// Backend-only Solana layer: reward payouts + SPL token-holding verification.
//
// SECURITY: Private keys are read ONLY from process.env (server/.env), are never
// imported into client code, never returned by any API response, and never logged.
// Only PUBLIC keys are ever exposed.
//
// If keys / RPC are not configured, the module runs in MOCK mode: payouts record a
// generated hash but perform no transfer, and token verification returns
// "unverified" (players can still play casually, but generate no rewards). This keeps
// local development working without funded wallets or a paid RPC.
// ---------------------------------------------------------------------------
import "dotenv/config";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";

const RPC_URL = process.env.SOLANA_RPC_URL || "";
// Official BULLSTRIKE ($BS) mint. Overridable via the TOKEN_CA env (Render sets it),
// but defaulted here so /api/config + verification use the right CA even if env is unset.
const TOKEN_CA = (process.env.TOKEN_CA || "CkZTQQw1gNrqv1q4V5txXURJ6Htp1T8Qjz5gZbS4pump").trim();
const MIN_TOKENS = Number(process.env.MIN_TOKENS || 250000);
// Display ticker/symbol for the token, surfaced to the client via /api/config.
const TOKEN_TICKER = (process.env.TOKEN_TICKER || "BS").trim();

// DEV-ONLY bypass. When DISABLE_TOKEN_VERIFICATION=true the real verification code
// below is skipped: every wallet is treated as a verified holder so the full app can
// be tested without holding tokens. Set to false (or unset) in production to restore
// the real 250,000-token on-chain SPL balance check. NEVER enable in production.
const DISABLE_TOKEN_VERIFICATION =
  String(process.env.DISABLE_TOKEN_VERIFICATION || "").toLowerCase() === "true";

/** Load a Keypair from a base58 string (Phantom export) or a JSON array. Never logs the secret. */
function loadKeypair(secret, label) {
  if (!secret || !secret.trim()) return null;
  const s = secret.trim();
  try {
    const bytes = s.startsWith("[") ? Uint8Array.from(JSON.parse(s)) : bs58.decode(s);
    return Keypair.fromSecretKey(bytes);
  } catch {
    console.error(`[solana] ${label}: failed to parse private key (check server/.env format)`);
    return null;
  }
}

const treasuryKeypair = loadKeypair(process.env.TREASURY_WALLET_PRIVATE_KEY, "TREASURY");
const rewardsKeypair = loadKeypair(process.env.CREATOR_REWARDS_WALLET_PRIVATE_KEY, "CREATOR_REWARDS");

function pubkeyOf(keypair, envPub) {
  if (keypair) return keypair.publicKey.toBase58();
  return (envPub || "").trim() || null;
}
const TREASURY_PUBLIC_KEY = pubkeyOf(treasuryKeypair, process.env.TREASURY_PUBLIC_KEY);
const CREATOR_REWARDS_PUBLIC_KEY = pubkeyOf(rewardsKeypair, process.env.CREATOR_REWARDS_PUBLIC_KEY);

const connection = RPC_URL ? new Connection(RPC_URL, "confirmed") : null;

const TREASURY_LIVE = !!(connection && treasuryKeypair);
const REWARDS_LIVE = !!(connection && rewardsKeypair);

const SOURCE = {
  treasury: { keypair: treasuryKeypair, live: TREASURY_LIVE },
  rewards: { keypair: rewardsKeypair, live: REWARDS_LIVE },
};

async function transfer(fromKeypair, toAddress, amountSol) {
  const toPubkey = new PublicKey(toAddress); // throws on malformed address
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  if (lamports <= 0) throw new Error("amount must be > 0");
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: fromKeypair.publicKey, toPubkey, lamports })
  );
  return sendAndConfirmTransaction(connection, tx, [fromKeypair], { commitment: "confirmed" });
}

/**
 * Send a reward payout from a named backend wallet.
 *   source: "treasury" (player payouts) | "rewards" (creator reward claims)
 * Returns { signature, onchain }. In mock mode onchain=false and signature is null.
 */
export async function sendPayout(source, toAddress, amountSol) {
  const src = SOURCE[source];
  if (!src) throw new Error(`unknown payout source: ${source}`);
  if (!src.live) return { signature: null, onchain: false };
  const signature = await transfer(src.keypair, toAddress, amountSol);
  return { signature, onchain: true };
}

/** Validate a Solana public key (address) string. */
export function isValidPublicKey(addr) {
  if (!addr || typeof addr !== "string") return false;
  try {
    new PublicKey(addr.trim());
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Token-holding verification: a player is "verified" if their wallet holds at least
// MIN_TOKENS of the configured TOKEN_CA mint on mainnet. Sums across all token
// accounts the owner holds for that mint.
// ---------------------------------------------------------------------------
/**
 * Read the on-chain SPL token balance of `wallet` for TOKEN_CA.
 * Returns { ok, verified, balance, mock, error }.
 *   - mock=true when no RPC or no TOKEN_CA is configured (cannot verify -> not verified).
 */
export async function getTokenBalance(wallet) {
  if (!isValidPublicKey(wallet)) return { ok: false, error: "invalid wallet address" };
  // DEV bypass: everyone verified, no RPC, no minimum holding. The real check below
  // is preserved and runs again the moment this flag is off.
  if (DISABLE_TOKEN_VERIFICATION) {
    return { ok: true, verified: true, balance: MIN_TOKENS, devBypass: true };
  }
  if (!connection || !TOKEN_CA) {
    // Cannot verify without an RPC + mint — treat as unverified but allow casual play.
    return { ok: true, mock: true, verified: false, balance: 0 };
  }
  let owner, mint;
  try {
    owner = new PublicKey(wallet.trim());
    mint = new PublicKey(TOKEN_CA);
  } catch {
    return { ok: false, error: "invalid wallet or token mint" };
  }
  try {
    const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint });
    let balance = 0;
    for (const { account } of resp.value) {
      const amt = account.data?.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof amt === "number") balance += amt;
    }
    return { ok: true, verified: balance >= MIN_TOKENS, balance };
  } catch (e) {
    return { ok: false, error: "RPC token lookup failed: " + e.message };
  }
}

/** On-chain SOL balance of an address (for treasury transparency). null in MOCK / on error. */
export async function getSolBalance(address) {
  if (!connection || !isValidPublicKey(address)) return null;
  try {
    const lamports = await connection.getBalance(new PublicKey(address.trim()), "confirmed");
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return null;
  }
}

export { LAMPORTS_PER_SOL, MIN_TOKENS, TOKEN_CA };

export const solanaConfig = {
  rpcConfigured: !!connection,
  treasuryLive: TREASURY_LIVE,
  rewardsLive: REWARDS_LIVE,
  treasuryPublicKey: TREASURY_PUBLIC_KEY,
  rewardsPublicKey: CREATOR_REWARDS_PUBLIC_KEY,
  tokenCA: TOKEN_CA || null,
  minTokens: MIN_TOKENS,
  ticker: TOKEN_TICKER,
  verifyLive: !!(connection && TOKEN_CA),
  disableTokenVerification: DISABLE_TOKEN_VERIFICATION,
};

export function logStartup() {
  const payMode = TREASURY_LIVE ? "LIVE (on-chain)" : "MOCK (no transfers)";
  const verMode = DISABLE_TOKEN_VERIFICATION
    ? "DEV BYPASS (everyone verified — DISABLE_TOKEN_VERIFICATION=true)"
    : solanaConfig.verifyLive
    ? "LIVE (on-chain SPL balance)"
    : "MOCK (all unverified)";
  console.log(`[solana] payout mode: ${payMode}`);
  console.log(`[solana] verify mode: ${verMode}`);
  if (connection) console.log(`[solana] rpc: ${RPC_URL}`);
  if (TOKEN_CA) console.log(`[solana] token CA: ${TOKEN_CA} (min ${MIN_TOKENS})`);
  if (TREASURY_PUBLIC_KEY) console.log(`[solana] treasury pubkey: ${TREASURY_PUBLIC_KEY}`);
  if (CREATOR_REWARDS_PUBLIC_KEY) console.log(`[solana] rewards pubkey:  ${CREATOR_REWARDS_PUBLIC_KEY}`);
}
