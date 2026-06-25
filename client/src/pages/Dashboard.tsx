import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { usePlayer } from "../lib/player";
import type { GameMap, RewardsView } from "../lib/types";
import { fmtSol, shortWallet } from "../lib/config";
import { MapThumb } from "../components/MapThumb";
import { Coins, Wrench, Play, Target } from "../components/icons";

export default function Dashboard() {
  const { wallet, config } = usePlayer();
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [rewards, setRewards] = useState<RewardsView | null>(null);
  const [treasury, setTreasury] = useState<{ treasuryBalance: number | null; pendingRewards: number; totalPaid: number; treasuryWallet: string | null } | null>(null);
  const [forceMsg, setForceMsg] = useState<string | null>(null);
  const [forcing, setForcing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const baseNext = useRef(0);
  const fetchedAt = useRef(0);

  const refresh = useCallback(() => {
    if (!wallet) return;
    api.listMaps({ creator: wallet }).then(setMaps).catch(() => {});
    api.treasury().then(setTreasury).catch(() => {});
    api.rewards(wallet).then((r) => {
      setRewards(r);
      baseNext.current = r.next_settlement_ms;
      fetchedAt.current = Date.now();
    }).catch(() => {});
  }, [wallet]);

  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, [refresh]);

  // live settlement countdown
  useEffect(() => {
    const t = setInterval(() => {
      const remaining = Math.max(0, baseNext.current - (Date.now() - fetchedAt.current));
      setCountdown(remaining);
      if (remaining === 0) refresh();
    }, 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const forceSettlement = async () => {
    const stored = localStorage.getItem("counterstrike.adminSecret") || "";
    const secret = stored || window.prompt("Enter ADMIN_SECRET to force settlement:") || "";
    if (!secret) return;
    localStorage.setItem("counterstrike.adminSecret", secret);
    setForcing(true);
    setForceMsg(null);
    try {
      const r = await api.forceSettlement(secret);
      const errs = (r.payoutErrors || []).map((e: any) => e.error).join("; ");
      setForceMsg(
        `Settled ${r.creatorsProcessed} creator(s) · paid ${r.amountPaid} SOL · pending ${r.pendingBefore}→${r.pendingAfter} SOL` +
        (r.lastTxSignature ? ` · tx ${String(r.lastTxSignature).slice(0, 10)}…` : r.onchain ? "" : " · (MOCK: no on-chain transfer — set treasury key + RPC)") +
        (errs ? ` · errors: ${errs}` : "")
      );
      refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) localStorage.removeItem("counterstrike.adminSecret");
      setForceMsg(e instanceof ApiError ? `Force settlement failed: ${e.message}` : "Force settlement failed");
    } finally {
      setForcing(false);
    }
  };

  if (!wallet)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="panel p-8 text-center max-w-sm">
          <Coins size={28} className="text-accent mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Creator Dashboard</h2>
          <p className="text-steel text-sm">Set your identity to view your reward ledger.</p>
        </div>
      </div>
    );

  const mm = String(Math.floor(countdown / 60000)).padStart(2, "0");
  const ss = String(Math.floor((countdown % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
        <Coins size={22} className="text-accent" /> Creator Reward Ledger
      </h1>
      <p className="text-steel text-sm mb-6"><span className="text-white">Validated PvP kills on your map earn creator rewards</span> in <span className="text-accent">SOL</span> (NPC kills pay 0). The ledger settles automatically every 5 minutes — never per kill — <span className="text-white">paid by the Treasury wallet</span>. Reward per validated kill: <span className="font-mono text-white">{fmtSol(rewards?.reward_per_kill)}</span>.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Big label="Pending SOL Rewards" value={fmtSol(rewards?.pending)} accent big />
        <Big label="Lifetime SOL Earned" value={fmtSol(rewards?.balance)} accent />
        <Big label="Last Settlement" value={fmtSol(rewards?.last_settlement)} />
        <Big label="Validated Kills" value={`${rewards?.validated_kills ?? 0}`} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Panel label="Next Settlement"><span className="font-mono text-3xl text-accent">{mm}:{ss}</span></Panel>
        <Panel label="Active Matches"><span className="font-mono text-3xl text-white">{rewards?.active_matches ?? 0}</span></Panel>
        <Panel label="Unique Players Today"><span className="font-mono text-3xl text-white">{rewards?.unique_players_today ?? 0}</span></Panel>
        <Panel label="Activity Score"><span className="font-mono text-3xl text-white">{rewards?.activity_score ?? 0}</span></Panel>
      </div>

      {/* Treasury transparency — creator rewards are paid by the Treasury wallet */}
      <div className="panel p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="label">Treasury · Paid by Treasury</span>
          <span className="font-mono text-[11px] text-steel">{shortWallet(treasury?.treasuryWallet, 5)}</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><div className="label">Treasury Balance</div><div className="font-mono text-2xl text-white mt-1">{treasury?.treasuryBalance != null ? fmtSol(treasury.treasuryBalance) : "—"}</div></div>
          <div><div className="label">Pending Rewards</div><div className="font-mono text-2xl text-accent mt-1">{fmtSol(treasury?.pendingRewards)}</div></div>
          <div><div className="label">Total Paid Out</div><div className="font-mono text-2xl text-verify mt-1">{fmtSol(treasury?.totalPaid)}</div></div>
        </div>

        {config?.rewardMode === "testing" && (
          <div className="mt-4 pt-4 border-t border-base-500">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="chip border-accent/40 bg-accent/10 text-accent">Testing mode</span>
              <button className="btn btn-accent h-9 px-4" disabled={forcing} onClick={forceSettlement}>
                {forcing ? "Settling…" : "Force Settlement Now"}
              </button>
              <span className="text-[11px] text-steel">Pays all pending creator rewards immediately from the Treasury. Requires ADMIN_SECRET.</span>
            </div>
            {forceMsg && <div className="mt-2 text-xs font-mono text-steel break-words">{forceMsg}</div>}
          </div>
        )}
      </div>

      {rewards?.flagged && <div className="panel p-3 text-kill text-sm mb-6">This account is flagged for review — settlements are paused.</div>}

      <div className="flex items-center justify-between mb-3">
        <h2 className="label">My maps</h2>
        <Link to="/create" className="btn btn-accent h-8 px-3"><Wrench size={15} /> New map</Link>
      </div>

      {maps.length === 0 ? (
        <div className="panel p-10 text-center text-steel">No maps yet. <Link to="/create" className="text-accent">Build your first one.</Link></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {maps.map((m) => (
            <div key={m.map_id} className="panel overflow-hidden">
              <div className="aspect-video bg-base-900 border-b border-base-500 relative">
                <MapThumb map={m} className="w-full h-full" />
                <span className={`absolute top-2 left-2 chip ${m.published ? "border-verify/50 text-verify bg-verify/10" : "border-base-400 text-steel bg-base-800"}`}>{m.published ? "Published" : "Draft"}</span>
                <span className="absolute top-2 right-2 chip border-base-500 bg-base-900/70 font-mono text-steel">
                  <span className={`w-1.5 h-1.5 rounded-full ${(m.active_players ?? 0) > 0 ? "bg-verify animate-pulse" : "bg-base-400"}`} /> {m.active_players ?? 0}/{m.max_players ?? 16}
                </span>
              </div>
              <div className="p-3">
                <h3 className="font-bold text-white truncate">{m.title}</h3>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <Mini label="Valid Kills" value={m.stats.verified_kills} />
                  <Mini label="Players" value={m.stats.unique_verified_players} />
                  <Mini label="Plays" value={m.stats.plays} />
                </div>
                <div className="flex gap-2 mt-3">
                  <Link to={`/edit/${m.map_id}`} className="btn flex-1 h-8 text-xs"><Wrench size={13} /> Edit</Link>
                  <Link to={`/play/${m.map_id}`} className="btn flex-1 h-8 text-xs"><Play size={13} /> Play</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Big({ label, value, accent, big }: { label: string; value: string; accent?: boolean; big?: boolean }) {
  return (
    <div className={`panel p-4 ${big ? "ring-1 ring-accent/30" : ""}`}>
      <div className="label">{label}</div>
      <div className={`font-mono ${big ? "text-4xl" : "text-3xl"} mt-1 ${accent ? "text-accent" : "text-white"}`}>{value}</div>
    </div>
  );
}
function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="panel p-4"><div className="label mb-1">{label}</div>{children}</div>;
}
function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-base-500 bg-base-800 py-1">
      <div className="font-mono text-accent text-sm flex items-center justify-center gap-1"><Target size={10} /> {value}</div>
      <div className="label text-[9px]">{label}</div>
    </div>
  );
}
