import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LobbyScene } from "../three/LobbyScene";
import { Nav, DevModeBadge } from "../components/Nav";
import { IdentityModal, VerifyBadge } from "../components/IdentityModal";
import { MapThumb } from "../components/MapThumb";
import { usePlayer } from "../lib/player";
import { api } from "../lib/api";
import { shortWallet } from "../lib/config";
import type { GameMap } from "../lib/types";
import { Target, Wrench, Coins, Globe, Play, Shield, User } from "../components/icons";

export default function Home() {
  const { wallet, username, player, config } = usePlayer();
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [featured, setFeatured] = useState<GameMap | null>(null);
  const [rewardsPool, setRewardsPool] = useState<number | null>(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    api.listMaps({ published: true, sort: "newest" }).then((m) => setMaps(m)).catch(() => {});
    api.listMaps({ published: true, sort: "trending" }).then((m) => setFeatured(m[0] || null)).catch(() => {});
    api.treasury().then((t) => setRewardsPool(t.rewards)).catch(() => {});
  }, []);

  const mapsLive = maps.length;
  const killsTracked = maps.reduce((a, m) => a + m.stats.total_kills, 0);
  const playersTracked = maps.reduce((a, m) => a + m.stats.unique_verified_players, 0);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-base-900">
      {/* 3D lobby background */}
      <div className="absolute inset-0">
        <LobbyScene />
      </div>
      {/* readability gradients */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-base-900 via-base-900/10 to-base-900/40" />
      <div className="absolute inset-y-0 left-0 w-[34rem] pointer-events-none bg-gradient-to-r from-base-900/85 to-transparent hidden lg:block" />
      <div className="absolute inset-y-0 right-0 w-[30rem] pointer-events-none bg-gradient-to-l from-base-900/85 to-transparent hidden lg:block" />

      <Nav overlay />

      {/* LEFT PANEL */}
      <aside className="absolute left-4 top-20 bottom-28 w-72 hidden lg:flex flex-col gap-3 overflow-y-auto scroll-thin pr-1">
        <Panel title="Featured Arena" icon={Target}>
          {featured ? (
            <Link to={`/game/${featured.map_id}`} className="block group">
              <div className="aspect-video bg-base-900 border border-base-500 overflow-hidden relative">
                <MapThumb map={featured} className="w-full h-full" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-base-900/50 transition-opacity">
                  <span className="chip border-accent text-accent"><Play size={12} /> Drop In</span>
                </div>
              </div>
              <div className="mt-1.5 font-bold text-white text-sm truncate">{featured.title}</div>
              <div className="text-[11px] text-steel">{featured.stats.verified_kills} kills · {featured.stats.unique_verified_players} players</div>
            </Link>
          ) : (
            <Empty>No arenas published yet.</Empty>
          )}
        </Panel>

        <Panel title="Latest Maps" icon={Globe}>
          {maps.length ? (
            <div className="space-y-1.5">
              {maps.slice(0, 4).map((m) => (
                <Link key={m.map_id} to={`/game/${m.map_id}`} className="flex items-center gap-2 group">
                  <div className="w-12 h-9 bg-base-900 border border-base-500 overflow-hidden shrink-0">
                    <MapThumb map={m} className="w-full h-full" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate group-hover:text-accent">{m.title}</div>
                    <div className="text-[10px] text-steel">{m.creator_username || shortWallet(m.creator)}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty>Be the first to publish.</Empty>
          )}
        </Panel>

        <Panel title="Map Builder" icon={Wrench}>
          <p className="text-xs text-steel mb-2">Tactical 3D editor is live — walls, ramps, cover, spawns, pickups.</p>
          <Link to="/create" className="btn btn-accent w-full h-8 text-xs">Open builder</Link>
        </Panel>
      </aside>

      {/* RIGHT PANEL */}
      <aside className="absolute right-4 top-20 w-64 hidden lg:flex flex-col gap-3">
        <Panel title="Operations Status" icon={Shield}>
          <Row label="Status"><span className="flex items-center gap-1.5 text-verify"><span className="w-1.5 h-1.5 bg-verify rounded-full animate-pulse" /> Online</span></Row>
          <Row label="Network"><span className="text-white font-mono">{config?.cluster || "mainnet-beta"}</span></Row>
          <Row label="Maps live"><span className="text-accent font-mono">{mapsLive}</span></Row>
          <Row label="Kills tracked"><span className="text-accent font-mono">{killsTracked}</span></Row>
          <Row label="Verified players"><span className="text-accent font-mono">{playersTracked}</span></Row>
          <Row label="Rewards pool"><span className="text-accent font-mono">{rewardsPool != null ? `${rewardsPool} SOL` : "—"}</span></Row>
        </Panel>
        {config?.devVerifyOff && (
          <div className="panel p-3 border-accent/40">
            <DevModeBadge />
            <p className="text-[11px] text-steel mt-2 leading-relaxed">Token verification is bypassed for testing. Everyone counts as verified.</p>
          </div>
        )}
      </aside>

      {/* CENTER COPY + CTA */}
      <div className="absolute inset-x-0 bottom-32 flex flex-col items-center text-center px-4 pointer-events-none">
        <div className="chip border-accent/40 bg-accent/10 text-accent mb-4 pointer-events-auto">Tactical FPS map platform · Solana mainnet</div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-[1.05] drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
          Build tactical maps.<br />Earn from <span className="text-accent">verified kills</span>.
        </h1>
        <p className="mt-3 text-steel max-w-xl text-sm md:text-base">
          Drop into player-made arenas. No wagers. No betting. Just maps, fights, and rewards.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center pointer-events-auto">
          <Link to="/play" className="btn btn-accent px-8 py-3.5 text-base shadow-[0_0_30px_-8px_rgba(245,166,35,0.6)]">
            <Target size={18} /> Play Maps
          </Link>
          <Link to="/create" className="btn px-8 py-3.5 text-base bg-base-700/80 backdrop-blur">
            <Wrench size={18} /> Create Map
          </Link>
        </div>
      </div>

      {/* BOTTOM PLAYER CARD */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(92vw,30rem)]">
        <div className="panel px-4 py-3 flex items-center gap-3 bg-base-800/85 backdrop-blur">
          <div className="w-11 h-11 bg-base-600 border border-base-400 flex items-center justify-center shrink-0">
            <User size={22} className="text-accent" />
          </div>
          {wallet ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white truncate">{username}</span>
                  <span className="chip border-base-500 text-steel text-[9px]">RECRUIT · LVL {Math.floor((player?.stats.kills || 0) / 5) + 1}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-steel font-mono">{shortWallet(wallet, 5)}</span>
                  {config?.devVerifyOff ? <span className="chip border-accent/50 text-accent text-[9px]">DEV VERIFIED</span> : <VerifyBadge player={player} />}
                </div>
              </div>
              <button className="btn h-8 px-3 text-xs" onClick={() => setModal(true)}>Edit Profile</button>
            </>
          ) : (
            <>
              <div className="flex-1">
                <div className="font-bold text-white">No operator identity</div>
                <div className="text-[11px] text-steel">Set a username + payout wallet to play and earn.</div>
              </div>
              <button className="btn btn-accent h-8 px-3 text-xs" onClick={() => setModal(true)}>Set identity</button>
            </>
          )}
        </div>
      </div>

      {/* mobile CTA fallback for dev badge */}
      <div className="absolute top-16 right-3 lg:hidden">
        <DevModeBadge />
      </div>

      {modal && <IdentityModal onClose={() => setModal(false)} />}
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="panel p-3 bg-base-800/80 backdrop-blur">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={14} className="text-accent" />
        <span className="label">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm border-b border-base-600/50 last:border-0">
      <span className="text-steel text-xs">{label}</span>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-steel/70">{children}</p>;
}
