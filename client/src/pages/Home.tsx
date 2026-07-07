import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LobbyScene } from "../three/LobbyScene";
import { Nav } from "../components/Nav";
import { IdentityModal, VerifyBadge } from "../components/IdentityModal";
import { ContractAddress } from "../components/ContractAddress";
import { MapThumb } from "../components/MapThumb";
import { usePlayer } from "../lib/player";
import { api } from "../lib/api";
import { shortWallet, fmtSol, TICKER_TAG, SOCIALS, SITE_URL } from "../lib/config";
import type { GameMap } from "../lib/types";
import { useSide, SIDES } from "../lib/side";
import { Target, Wrench, Coins, Globe, Play, Shield, User } from "../components/icons";

export default function Home() {
  const { wallet, username, player, config } = usePlayer();
  const side = useSide((s) => s.side);
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [featured, setFeatured] = useState<GameMap | null>(null);
  const [totalPaid, setTotalPaid] = useState<number | null>(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    api.listMaps({ published: true, sort: "newest" }).then((m) => setMaps(m)).catch(() => {});
    api.listMaps({ published: true, sort: "trending" }).then((m) => setFeatured(m[0] || null)).catch(() => {});
    api.treasury().then((t) => setTotalPaid(t.totalPaid)).catch(() => {});
  }, []);

  const mapsLive = maps.length;
  const killsTracked = maps.reduce((a, m) => a + m.stats.total_kills, 0);
  const playersTracked = maps.reduce((a, m) => a + m.stats.unique_verified_players, 0);

  return (
    <div className="bg-base-900">
      {/* HERO — full viewport, 3D lobby scene as the whole background */}
      <section className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <LobbyScene />
      </div>
      {/* dark gradient from the bottom: scene stays visible up top, text reads below */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-base-900 via-base-900/35 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-[34rem] pointer-events-none bg-gradient-to-r from-base-900/85 to-transparent hidden lg:block" />
      <div className="absolute inset-y-0 right-0 w-[30rem] pointer-events-none bg-gradient-to-l from-base-900/85 to-transparent hidden lg:block" />

      <Nav overlay />

      {/* top-center badge */}
      <div className="absolute top-16 inset-x-0 flex justify-center pointer-events-none">
        <span className="chip border-accent/40 bg-accent/10 text-accent animate-pulse pointer-events-auto">
          {TICKER_TAG} · Bulls vs Bears · Solana mainnet
        </span>
      </div>

      {/* LEFT PANEL */}
      <aside className="absolute left-4 top-20 bottom-28 w-72 hidden lg:flex flex-col gap-3 overflow-y-auto scroll-thin pr-1">
        <Panel title="Featured Arena" icon={Target}>
          {featured ? (
            <Link to={`/play/${featured.map_id}`} className="block group">
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
                <Link key={m.map_id} to={`/play/${m.map_id}`} className="flex items-center gap-2 group">
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
          <Row label="Paid to creators"><span className="text-accent font-mono">{totalPaid != null ? fmtSol(totalPaid) : "—"}</span></Row>
        </Panel>
      </aside>

      {/* CENTER COPY + CTA — stacked over the scene, readable on the bottom gradient */}
      <div className="absolute inset-x-0 bottom-32 flex flex-col items-center text-center px-4 pointer-events-none">
        <h1 className="text-2xl md:text-4xl text-white leading-[1.15] drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
          BUILD MAPS. <span className="text-accent">CHOOSE YOUR SIDE.</span><br />EARN FROM VERIFIED KILLS.
        </h1>
        <p className="mt-3 text-steel max-w-xl text-sm md:text-base">
          Bulls vs Bears — tactical combat in the forest. Verified {TICKER_TAG} holders fight on player-built maps. Creators earn from real kills.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center pointer-events-auto">
          <Link
            to="/play"
            className="btn btn-accent px-10 py-4 text-lg shadow-[0_0_30px_-8px_rgba(212,160,23,0.6)] transition-shadow hover:shadow-[0_0_44px_-4px_rgba(212,160,23,0.85)]"
          >
            <Target size={20} /> ENTER THE FOREST
          </Link>
          <Link to="/create" className="btn px-8 py-4 text-base bg-base-700/80">
            <Wrench size={18} /> Create Map
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] uppercase tracking-wider text-steel pointer-events-auto">
          <a href={SOCIALS.twitter} target="_blank" rel="noreferrer" className="hover:text-accent">@BULLSTRIKE_FUN</a>
          <span className="text-steel/40">·</span>
          <a href={SITE_URL} className="hover:text-accent">bullstrike.fun</a>
        </div>
        <ContractAddress className="mt-4 w-[min(92vw,30rem)] pointer-events-auto" />
      </div>

      {/* BOTTOM PLAYER CARD */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(92vw,30rem)]">
        <div className="panel px-4 py-3 flex items-center gap-3 bg-base-800/85">
          <div
            className="w-11 h-11 bg-base-600 border border-base-400 flex items-center justify-center shrink-0 text-2xl"
            style={side ? { borderColor: SIDES[side].color, background: `${SIDES[side].color}33` } : undefined}
          >
            {side ? SIDES[side].icon : <User size={22} className="text-accent" />}
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
                  <VerifyBadge player={player} />
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
      </section>

      {/* HOW IT WORKS — below the hero fold */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center mb-10">
          <div className="label mb-2">The loop</div>
          <h2 className="text-2xl md:text-3xl text-accent">HOW IT WORKS</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <HowCard icon="🗺️" title="BUILD" body="Design tactical forest maps with the in-browser editor." />
          <HowCard icon="⚔️" title="FIGHT" body="Choose bull or bear. Drop into real-time PvP on community maps." />
          <HowCard icon="💰" title="EARN" body={`Map creators earn ${TICKER_TAG} rewards from every verified kill on their battlefield.`} />
        </div>
      </section>

      {modal && <IdentityModal onClose={() => setModal(false)} />}
    </div>
  );
}

function HowCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="panel p-6 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg text-accent mb-2">{title}</h3>
      <p className="text-steel text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="panel p-3 bg-base-800/80">
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
