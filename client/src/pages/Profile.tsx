import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "../lib/player";
import { api } from "../lib/api";
import type { RewardsView } from "../lib/types";
import { IdentityModal, VerifyBadge } from "../components/IdentityModal";
import { shortWallet, fmtSol } from "../lib/config";
import { User, Shield } from "../components/icons";

export default function Profile() {
  const { wallet, username, player, config, verify, busy } = usePlayer();
  const [rewards, setRewards] = useState<RewardsView | null>(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    if (wallet) api.rewards(wallet).then(setRewards).catch(() => {});
  }, [wallet]);

  if (!wallet)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="panel p-8 text-center max-w-sm">
          <User size={28} className="text-accent mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">No identity set</h2>
          <p className="text-steel text-sm mb-5">Enter a username and payout wallet to start playing and earning.</p>
          <button className="btn btn-accent mx-auto" onClick={() => setModal(true)}>Set identity</button>
        </div>
        {modal && <IdentityModal onClose={() => setModal(false)} />}
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="panel p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-base-600 border border-base-400 flex items-center justify-center">
              <User size={26} className="text-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{username}</h1>
              <div className="flex items-center gap-2 mt-1">
                <VerifyBadge player={player} />
                <span className="text-steel font-mono text-xs">{shortWallet(wallet, 6)}</span>
              </div>
            </div>
          </div>
          <button className="btn h-8 px-3" onClick={() => setModal(true)}>Edit</button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <Stat label="Kills" value={player?.stats.kills ?? 0} />
          <Stat label="Deaths" value={player?.stats.deaths ?? 0} />
          <Stat label="Maps made" value={player?.stats.maps_created ?? 0} />
          <Stat label="Token balance" value={player?.token_balance ?? 0} />
        </div>
      </div>

      <div className="panel p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-white flex items-center gap-2"><Shield size={18} className="text-accent" /> Verification</h2>
          <button className="btn h-8 px-3" onClick={() => verify()} disabled={busy}>{busy ? "Checking…" : "Re-check"}</button>
        </div>
        <p className="text-sm text-steel leading-relaxed">
          {player?.verified ? (
            <>You are a <span className="text-verify font-semibold">verified player</span>. Your kills against other verified players generate rewards.</>
          ) : (
            <>Hold at least <span className="text-accent font-mono">{(config?.minTokens ?? 250000).toLocaleString()}</span> of the PumpStrike token in your payout wallet to become verified on Solana mainnet.</>
          )}
        </p>
      </div>

      <div className="panel p-6">
        <h2 className="font-bold text-white">Creator Earnings (SOL)</h2>
        <p className="text-[11px] text-steel mb-4">Paid by the Treasury wallet · settles every 5 minutes</p>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Pending SOL Rewards" value={fmtSol(rewards?.pending)} accent />
          <Stat label="Lifetime SOL Earned" value={fmtSol(rewards?.balance)} accent />
          <Stat label="Validated Kills" value={rewards?.validated_kills ?? 0} />
          <Stat label="Last Settlement" value={fmtSol(rewards?.last_settlement)} />
        </div>
        <Link to="/dashboard" className="btn w-full mt-4 h-9 text-xs">Open creator dashboard</Link>
      </div>

      {modal && <IdentityModal onClose={() => setModal(false)} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="border border-base-500 bg-base-800 p-3">
      <div className="label">{label}</div>
      <div className={`font-mono text-lg mt-0.5 ${accent ? "text-accent" : "text-white"}`}>{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}
