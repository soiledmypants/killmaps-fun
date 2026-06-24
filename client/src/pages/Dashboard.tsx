import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { usePlayer } from "../lib/player";
import type { GameMap, RewardsView } from "../lib/types";
import { MapThumb } from "../components/MapThumb";
import { Coins, Wrench, Globe, Play } from "../components/icons";

export default function Dashboard() {
  const { wallet, player } = usePlayer();
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [rewards, setRewards] = useState<RewardsView | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (!wallet) return;
    api.listMaps({ creator: wallet }).then(setMaps).catch(() => {});
    api.rewards(wallet).then(setRewards).catch(() => {});
  }, [wallet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const claim = async (type: "creator" | "player") => {
    if (!wallet) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api.claim(wallet, type);
      setRewards(r.rewards);
      setMsg(`Claimed ${r.tx.amount} SOL ${r.tx.onchain ? "(on-chain)" : "(recorded)"}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  if (!wallet)
    return (
      <Center>
        <Coins size={28} className="text-accent mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Creator Dashboard</h2>
        <p className="text-steel text-sm">Set your identity to view your maps and rewards.</p>
      </Center>
    );

  const totalKills = maps.reduce((a, m) => a + m.stats.verified_kills, 0);
  const totalPlayers = maps.reduce((a, m) => a + m.stats.unique_verified_players, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
        <Coins size={22} className="text-accent" /> Creator Dashboard
      </h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Big label="Maps" value={maps.length} />
        <Big label="Verified kills" value={totalKills} accent />
        <Big label="Unique players" value={totalPlayers} />
        <Big label="Creator points" value={rewards?.creator_points ?? 0} accent />
      </div>

      {/* Rewards / claim */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <ClaimCard
          title="Creator rewards"
          points={rewards?.creator_points ?? 0}
          sol={rewards?.creator_sol ?? 0}
          unlocked={rewards?.creator_unlocked ?? false}
          progress={rewards?.unlock_progress}
          minPoints={rewards?.min_creator_claim_points ?? 0}
          onClaim={() => claim("creator")}
          busy={busy}
        />
        <ClaimCard
          title="Player rewards"
          points={rewards?.player_points ?? 0}
          sol={rewards?.player_sol ?? 0}
          unlocked
          minPoints={rewards?.min_player_claim_points ?? 0}
          onClaim={() => claim("player")}
          busy={busy}
        />
      </div>

      {msg && <div className="panel p-3 text-verify text-sm mb-4">{msg}</div>}
      {err && <div className="panel p-3 text-kill text-sm mb-4">{err}</div>}

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
                <span className={`absolute top-2 left-2 chip ${m.published ? "border-verify/50 text-verify bg-verify/10" : "border-base-400 text-steel bg-base-800"}`}>
                  {m.published ? "Published" : "Draft"}
                </span>
              </div>
              <div className="p-3">
                <h3 className="font-bold text-white truncate">{m.title}</h3>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <Mini label="Kills" value={m.stats.verified_kills} />
                  <Mini label="Players" value={m.stats.unique_verified_players} />
                  <Mini label="Points" value={m.reward_stats?.creator_points ?? 0} />
                </div>
                <div className="flex gap-2 mt-3">
                  <Link to={`/edit/${m.map_id}`} className="btn flex-1 h-8 text-xs"><Wrench size={13} /> Edit</Link>
                  <Link to={`/game/${m.map_id}`} className="btn flex-1 h-8 text-xs"><Play size={13} /> Play</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClaimCard({ title, points, sol, unlocked, progress, minPoints, onClaim, busy }: {
  title: string; points: number; sol: number; unlocked: boolean;
  progress?: RewardsView["unlock_progress"]; minPoints: number; onClaim: () => void; busy: boolean;
}) {
  const canClaim = unlocked && points >= minPoints && sol > 0;
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white">{title}</h3>
        <Globe size={16} className="text-steel" />
      </div>
      <div className="flex items-end gap-2 mt-3">
        <span className="font-mono text-3xl text-accent">{sol.toFixed(4)}</span>
        <span className="text-steel text-sm mb-1">SOL</span>
        <span className="text-steel text-xs mb-1.5 ml-auto">{points.toLocaleString()} pts</span>
      </div>
      {!unlocked && progress && (
        <div className="mt-3 text-xs text-steel">
          <div className="mb-1">Unlock on <span className="text-white">{progress.title}</span>:</div>
          <Bar label="Players" value={progress.players} need={progress.players_needed} />
          <Bar label="Verified kills" value={progress.kills} need={progress.kills_needed} />
        </div>
      )}
      <button className="btn btn-accent w-full mt-4 disabled:opacity-40" disabled={!canClaim || busy} onClick={onClaim}>
        {busy ? "Processing…" : canClaim ? "Claim SOL" : !unlocked ? "Locked" : points < minPoints ? `Need ${minPoints} pts` : "Nothing to claim"}
      </button>
    </div>
  );
}

function Bar({ label, value, need }: { label: string; value: number; need: number }) {
  const pct = Math.min(100, (value / need) * 100);
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[11px] mb-0.5"><span>{label}</span><span className="font-mono text-white">{value}/{need}</span></div>
      <div className="h-1.5 bg-base-900 border border-base-500"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Big({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>
      <div className={`font-mono text-3xl mt-1 ${accent ? "text-accent" : "text-white"}`}>{value.toLocaleString()}</div>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-base-500 bg-base-800 py-1">
      <div className="font-mono text-accent text-sm">{value}</div>
      <div className="label text-[9px]">{label}</div>
    </div>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center min-h-[60vh]"><div className="panel p-8 text-center max-w-sm">{children}</div></div>;
}
