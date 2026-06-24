import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { GameMap } from "../lib/types";
import { usePlayer } from "../lib/player";
import { useGame } from "../lib/gameStore";
import { WEAPONS, resolveRules } from "../lib/fps";
import { FPSScene } from "../three/FPSScene";
import { sound, unlockAudio } from "../lib/sound";
import { useNet } from "../lib/net";
import { Target, X } from "../components/icons";
import { VerifyBadge } from "../components/IdentityModal";

const MATCH_SECONDS = 180;

export default function Game() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const test = params.get("test") === "1";
  const nav = useNavigate();
  const { wallet, player } = usePlayer();
  const game = useGame();
  const [map, setMap] = useState<GameMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const matchId = useRef<string | null>(null);
  const reset = useGame((s) => s.reset);

  // load map + start match
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    api
      .getMap(id)
      .then(async (m) => {
        if (cancelled) return;
        setMap(m);
        const r = resolveRules(m);
        reset(r.starting_weapon, WEAPONS[r.starting_weapon].mag, MATCH_SECONDS);
        try {
          const { match } = await api.startMatch(m.map_id, "ffa", wallet || undefined);
          matchId.current = match.match_id;
        } catch {
          /* match tracking is best-effort */
        }
      })
      .catch(() => setError("Map not found"));
    return () => {
      cancelled = true;
      if (matchId.current) api.endMatch(matchId.current).catch(() => {});
      document.exitPointerLock?.();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // match timer
  useEffect(() => {
    if (game.status !== "playing") return;
    const t = setInterval(() => {
      const s = useGame.getState();
      const next = s.timeLeft - 1;
      if (next <= 0) {
        s.set({ timeLeft: 0, status: "over" });
        document.exitPointerLock?.();
        if (matchId.current) api.endMatch(matchId.current).catch(() => {});
      } else s.set({ timeLeft: next });
    }, 1000);
    return () => clearInterval(t);
  }, [game.status]);

  const cbs = {
    onMove: (distance: number) => {
      if (matchId.current && wallet) api.matchEvent(matchId.current, { wallet, distance }).catch(() => {});
    },
    onKill: async (info: { weapon: string; ctx: Record<string, number> }) => {
      if (!matchId.current) return;
      try {
        const res = await api.recordKill({
          match_id: matchId.current,
          map_id: id,
          killer: wallet || "practice",
          victim: "bot",
          weapon: info.weapon,
          time_since_spawn_ms: info.ctx.time_since_spawn_ms,
          fire_rate: info.ctx.fire_rate,
          accuracy: info.ctx.accuracy,
          killer_distance: info.ctx.killer_distance,
        });
        useGame.getState().set({
          lastKillInfo: res.counted ? "Verified kill counted" : `Practice kill (${res.reasons[0] || "not counted"})`,
        });
      } catch {
        /* ignore */
      }
    },
  };

  const lock = () => {
    unlockAudio();
    sound.ui();
    (document.querySelector("canvas") as HTMLCanvasElement | null)?.requestPointerLock();
  };
  const playAgain = () => {
    const r = map ? resolveRules(map) : { starting_weapon: "m4" as const };
    reset(r.starting_weapon, WEAPONS[r.starting_weapon].mag, MATCH_SECONDS);
    api.startMatch(id!, "ffa", wallet || undefined).then(({ match }) => (matchId.current = match.match_id)).catch(() => {});
    setTimeout(lock, 50);
  };

  if (error)
    return (
      <div className="h-screen flex items-center justify-center bg-base-900 text-center">
        <div className="panel p-8">
          <p className="text-kill mb-4">{error}</p>
          <Link to="/play" className="btn">Back to maps</Link>
        </div>
      </div>
    );

  if (!map) return <div className="h-screen flex items-center justify-center bg-base-900 text-steel">Loading arena…</div>;

  return (
    <div className="h-screen w-screen relative bg-base-900 overflow-hidden select-none">
      <FPSScene map={map} test={test} cbs={cbs} />

      {/* Crosshair */}
      {game.status === "playing" && <div className="crosshair absolute inset-0 pointer-events-none" />}
      {game.status === "playing" && performance.now() - game.hitMarker < 140 && (
        <div
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl font-bold pointer-events-none ${
            performance.now() - game.headMarker < 140 ? "text-kill scale-125" : "text-white"
          }`}
        >
          ✕
        </div>
      )}

      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none">
        {/* top bar */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between p-3">
          <div className="panel px-3 py-1.5 flex items-center gap-3">
            <span className="font-bold text-white text-sm truncate max-w-[160px]">{map.title}</span>
            {test && <span className="chip border-accent/50 text-accent">Test</span>}
            <PlayerCount mapId={map.map_id} />
          </div>
          <div className="panel px-5 py-1.5 font-mono text-2xl text-white tabular-nums">
            {String(Math.floor(game.timeLeft / 60)).padStart(2, "0")}:{String(game.timeLeft % 60).padStart(2, "0")}
          </div>
          <div className="panel px-3 py-1.5 flex items-center gap-4">
            <Score label="K" value={game.kills} className="text-verify" />
            <Score label="D" value={game.deaths} className="text-kill" />
            <Score label="Score" value={game.score} className="text-accent" />
          </div>
        </div>

        {/* kill feed */}
        <div className="absolute top-16 right-3 space-y-1 text-sm">
          {game.feed.map((f) => (
            <div key={f.id} className="panel px-2.5 py-1 flex items-center gap-2">
              <span className={f.killer === "You" ? "text-verify font-semibold" : "text-steel"}>{f.killer}</span>
              <span className="text-steel/50 text-xs uppercase">{f.weapon}</span>
              {f.head && <span className="text-kill text-[10px] font-bold uppercase tracking-wider">Headshot</span>}
              <Target size={12} className="text-kill" />
              <span className={f.victim === "You" ? "text-kill font-semibold" : "text-steel"}>{f.victim}</span>
            </div>
          ))}
        </div>

        {/* bottom HUD: health + ammo */}
        <div className="absolute bottom-0 inset-x-0 p-4 flex items-end justify-between">
          <div className="panel px-4 py-2 w-52">
            <div className="flex items-center justify-between mb-1">
              <span className="label">Health</span>
              <span className={`font-mono font-bold ${game.health > 30 ? "text-white" : "text-kill"}`}>{game.health}</span>
            </div>
            <div className="h-2 bg-base-900 border border-base-500">
              <div className={`h-full ${game.health > 30 ? "bg-verify" : "bg-kill"}`} style={{ width: `${game.health}%` }} />
            </div>
          </div>

          {game.lastKillInfo && <div className="panel px-3 py-1.5 text-xs text-steel">{game.lastKillInfo}</div>}

          <div className="panel px-4 py-2 text-right">
            <div className="label">{WEAPONS[game.weapon].name}</div>
            <div className="font-mono text-2xl text-white tabular-nums">
              {game.reloading ? <span className="text-accent text-base">RELOADING</span> : <>{game.ammo}<span className="text-steel text-base"> / {game.mag}</span></>}
            </div>
          </div>
        </div>
      </div>

      {/* Click-to-play overlay */}
      {(game.status === "ready" || game.status === "loading") && (
        <Overlay>
          <Target size={34} className="text-accent mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-white mb-1">{map.title}</h2>
          <p className="text-steel text-sm mb-1">by {map.creator_username || "creator"}</p>
          <div className="flex items-center justify-center gap-2 my-4">
            {player ? <VerifyBadge player={player} /> : <span className="chip border-base-400 text-steel">No identity — practice only</span>}
          </div>
          <button className="btn btn-accent px-6 py-3 pointer-events-auto" onClick={lock}>Click to drop in</button>
          <Controls />
        </Overlay>
      )}

      {/* Results */}
      {game.status === "over" && (
        <Overlay>
          <div className="label mb-2">Match Complete</div>
          <div className="grid grid-cols-3 gap-6 my-6">
            <ResultStat label="Kills" value={game.kills} className="text-verify" />
            <ResultStat label="Deaths" value={game.deaths} className="text-kill" />
            <ResultStat label="Score" value={game.score} className="text-accent" />
          </div>
          {!player?.verified && (
            <p className="text-steel text-sm max-w-sm mx-auto mb-5">
              These were practice kills. Verified token holders fighting each other generate real creator rewards.
            </p>
          )}
          <div className="flex items-center justify-center gap-2 pointer-events-auto">
            <button className="btn btn-accent" onClick={playAgain}>Play again</button>
            <Link to="/play" className="btn">Browse maps</Link>
            <button className="btn btn-ghost" onClick={() => nav(-1)}><X size={16} /></button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function PlayerCount({ mapId }: { mapId: string }) {
  const counts = useNet((s) => s.counts);
  const max = useNet((s) => s.maxPlayers);
  const active = counts[mapId] || 0;
  return <span className="chip border-base-500 text-steel font-mono">{active} / {max}</span>;
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-base-900/85 backdrop-blur-sm">
      <div className="panel p-8 text-center max-w-md pointer-events-auto">{children}</div>
    </div>
  );
}

function Controls() {
  return (
    <div className="mt-6 pt-5 border-t border-base-500 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-steel text-left">
      {[
        ["WASD", "Move"], ["Mouse", "Aim"], ["Click", "Fire"], ["Shift", "Sprint"],
        ["Space", "Jump"], ["Ctrl/C", "Crouch"], ["R", "Reload"], ["1·2·3", "Weapons"],
        ["Esc", "Release cursor"],
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between">
          <span className="font-mono text-white">{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}

function Score({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="text-center">
      <div className="label text-[9px]">{label}</div>
      <div className={`font-mono font-bold ${className}`}>{value}</div>
    </div>
  );
}

function ResultStat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <div className={`font-mono text-4xl font-bold ${className}`}>{value}</div>
      <div className="label mt-1">{label}</div>
    </div>
  );
}
