import { useState } from "react";
import { usePlayer } from "../lib/player";
import { Shield, Check, X } from "./icons";

export function VerifyBadge({ player }: { player: { verified: boolean; verify_mock?: boolean } | null }) {
  if (!player) return null;
  if (player.verified)
    return (
      <span className="chip border-verify/50 bg-verify/10 text-verify">
        <Check size={12} /> Verified
      </span>
    );
  return (
    <span className="chip border-base-400 bg-base-600 text-steel" title={player.verify_mock ? "Token verification is not configured on the server (mock mode)." : "Hold the required tokens to verify."}>
      Unverified
    </span>
  );
}

export function IdentityModal({ onClose }: { onClose: () => void }) {
  const { wallet, username, busy, error, config, register, verify, player, signOut } = usePlayer();
  const [u, setU] = useState(username);
  const [w, setW] = useState(wallet);
  const minTokens = config?.minTokens ?? 250000;

  const save = async () => {
    const ok = await register(w, u || "player");
    if (ok) await verify();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="panel w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Shield size={18} className="text-accent" /> Player Identity
          </h2>
          <button className="btn btn-ghost p-1" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-steel mb-5 leading-relaxed">
          Enter a username and your Solana <span className="text-white">payout wallet</span>. No wallet
          connect — your address is used to verify token holdings and to receive reward payouts.
          Hold at least <span className="text-accent font-mono">{minTokens.toLocaleString()}</span> tokens to
          become a verified player whose kills generate rewards.
        </p>

        <label className="label">Username</label>
        <input className="input mt-1 mb-4" value={u} maxLength={32} onChange={(e) => setU(e.target.value)} placeholder="callsign" />

        <label className="label">Solana payout wallet</label>
        <input className="input mt-1 mb-2 text-xs" value={w} onChange={(e) => setW(e.target.value)} placeholder="So1ana...address" />

        {error && <div className="text-kill text-sm mb-3">{error}</div>}

        <div className="flex items-center gap-2 mt-4">
          <button className="btn btn-accent flex-1" disabled={busy || !w.trim()} onClick={save}>
            {busy ? "Checking…" : player ? "Update & re-verify" : "Save & verify"}
          </button>
          {player && (
            <button className="btn" disabled={busy} onClick={() => verify()}>
              Re-check
            </button>
          )}
        </div>

        {player && (
          <div className="mt-4 pt-4 border-t border-base-500 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <VerifyBadge player={player} />
              <span className="text-steel font-mono">{player.token_balance?.toLocaleString() ?? 0} tokens</span>
            </div>
            <button className="text-steel hover:text-kill text-xs uppercase tracking-wider" onClick={() => { signOut(); onClose(); }}>
              Sign out
            </button>
          </div>
        )}
        {config && !config.verifyLive && (
          <p className="mt-3 text-[11px] text-steel/70">
            Note: server token verification is in mock mode (no RPC / token CA set). You can play and build;
            verified-kill rewards activate once the server is configured.
          </p>
        )}
      </div>
    </div>
  );
}
