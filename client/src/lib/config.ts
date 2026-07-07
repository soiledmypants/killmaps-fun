// Runtime config. Display-only values; the BACKEND (/api/config) is the source of
// truth for token verification + reward economics. No foundation-repo defaults are
// baked in — BULLSTRIKE must never inherit another project's token CA or wallets.

// BULLSTRIKE pump.fun token ($BS, mainnet). Override with VITE_TOKEN_CA if needed.
export const TOKEN_CA =
  (import.meta.env.VITE_TOKEN_CA as string | undefined)?.trim() || "CkZTQQw1gNrqv1q4V5txXURJ6Htp1T8Qjz5gZbS4pump";

// The CA + pump.fun link are shown by default. Set VITE_TOKEN_LIVE=false to hide them
// and show a "SOON" placeholder instead (pre-launch).
export const TOKEN_LIVE = (import.meta.env.VITE_TOKEN_LIVE as string | undefined)?.trim().toLowerCase() !== "false";

export const SOCIALS = {
  pumpfun:
    (import.meta.env.VITE_PUMPFUN_URL as string | undefined)?.trim() ||
    (TOKEN_CA ? `https://pump.fun/coin/${TOKEN_CA}` : ""),
  twitter: (import.meta.env.VITE_TWITTER_URL as string | undefined)?.trim() || "https://x.com/BULLSTRIKE_FUN",
};

export const BRAND = "BULLSTRIKE";
export const SITE_URL = "https://bullstrike.fun";

// Token ticker / symbol shown in the UI, e.g. "Hold 250,000 $BS". Env-overridable so it
// always matches the backend's TOKEN_TICKER (exposed via /api/config.ticker).
export const TICKER = (import.meta.env.VITE_TOKEN_TICKER as string | undefined)?.trim() || "BS";
export const TICKER_TAG = `$${TICKER}`; // e.g. "$BS"

export const MIN_TOKENS_DISPLAY = 250000;

/** Format a SOL amount for display, e.g. 0.0100 SOL. 4 dp so small per-kill rewards
 *  (0.01) render exactly rather than rounding. All rewards are denominated in SOL. */
export function fmtSol(n: number | null | undefined, dp = 4): string {
  return `${(Number(n) || 0).toFixed(dp)} SOL`;
}

export function solscanTx(sig: string, cluster = "mainnet"): string {
  const q = cluster && cluster !== "mainnet" ? `?cluster=${cluster}` : "";
  return `https://solscan.io/tx/${sig}${q}`;
}

export function shortWallet(w?: string | null, size = 4): string {
  if (!w) return "—";
  return w.length > size * 2 + 2 ? `${w.slice(0, size)}…${w.slice(-size)}` : w;
}
