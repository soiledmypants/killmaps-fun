// Runtime config. Display-only values; the BACKEND (/api/config) is the source of
// truth for token verification + reward economics. No Boss.fun defaults are baked in
// — KillMaps must never inherit another project's token CA or wallets.

// PumpStrike pump.fun token (mainnet). Override with VITE_TOKEN_CA if needed.
export const TOKEN_CA =
  (import.meta.env.VITE_TOKEN_CA as string | undefined)?.trim() || "8Ac6NUTzfk5FoC2VZ7fYkqFgZ6kBcKa9aaexAoAwpump";

export const SOCIALS = {
  pumpfun:
    (import.meta.env.VITE_PUMPFUN_URL as string | undefined)?.trim() ||
    (TOKEN_CA ? `https://pump.fun/coin/${TOKEN_CA}` : ""),
  twitter: (import.meta.env.VITE_TWITTER_URL as string | undefined)?.trim() || "https://x.com/CounterStrikePF",
};

export const BRAND = "PumpStrike";

export const MIN_TOKENS_DISPLAY = 250000;

/** Format a SOL amount for display, e.g. 0.0025 SOL. 4 dp so small per-kill rewards
 *  (0.0025) render exactly rather than rounding. All rewards are denominated in SOL. */
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
