import { useState } from "react";
import { TOKEN_CA, SOCIALS } from "../lib/config";
import { Copy, Check, Globe } from "./icons";

// Displays the PumpStrike token contract address with a one-click copy button.
// Reads TOKEN_CA from config (env-overridable) so it always matches /api/config.
export function ContractAddress({ className = "" }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!TOKEN_CA) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(TOKEN_CA);
    } catch {
      // clipboard API unavailable (insecure context) — fall back to a hidden textarea
      const ta = document.createElement("textarea");
      ta.value = TOKEN_CA;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`panel p-3 bg-base-800/85 backdrop-blur ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="label">Contract Address</span>
        {SOCIALS.pumpfun && (
          <a href={SOCIALS.pumpfun} target="_blank" rel="noreferrer" className="text-[10px] uppercase tracking-wider text-steel hover:text-accent flex items-center gap-1">
            <Globe size={11} /> pump.fun
          </a>
        )}
      </div>
      <div className="flex items-center gap-2">
        <code className="font-mono text-[11px] text-white truncate flex-1 select-all" title={TOKEN_CA}>{TOKEN_CA}</code>
        <button
          onClick={copy}
          className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider border transition-colors ${
            copied ? "border-verify/60 text-verify bg-verify/10" : "border-base-400 text-steel hover:text-white hover:bg-base-600"
          }`}
        >
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
    </div>
  );
}
