// Runtime config. Display-only values; the BACKEND (/api/config) is the source of
// truth for token verification + reward economics. No Boss.fun defaults are baked in
// — KillMaps must never inherit another project's token CA or wallets.

export const TOKEN_CA = (import.meta.env.VITE_TOKEN_CA as string | undefined)?.trim() || "";

export const SOCIALS = {
  pumpfun:
    (import.meta.env.VITE_PUMPFUN_URL as string | undefined)?.trim() ||
    (TOKEN_CA ? `https://pump.fun/coin/${TOKEN_CA}` : ""),
  twitter: (import.meta.env.VITE_TWITTER_URL as string | undefined)?.trim() || "",
};

export const MIN_TOKENS_DISPLAY = 250000;

export function solscanTx(sig: string, cluster = "mainnet"): string {
  const q = cluster && cluster !== "mainnet" ? `?cluster=${cluster}` : "";
  return `https://solscan.io/tx/${sig}${q}`;
}

export function shortWallet(w?: string | null, size = 4): string {
  if (!w) return "—";
  return w.length > size * 2 + 2 ? `${w.slice(0, size)}…${w.slice(-size)}` : w;
}
