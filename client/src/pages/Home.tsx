import { Link } from "react-router-dom";
import { Target, Wrench, Shield, Coins } from "../components/icons";
import { usePlayer } from "../lib/player";

const steps = [
  { icon: Wrench, title: "Build maps", body: "Lay out walls, ramps, cover, spawns and pickups in a tactical 3D editor. Save and publish to the arena." },
  { icon: Shield, title: "Get verified players", body: "Players enter a username + payout wallet. Holding the token makes them verified — no wallet connect required." },
  { icon: Target, title: "They fight on your maps", body: "Verified token holders drop into your arena. Browser FPS — move, aim, shoot, respawn." },
  { icon: Coins, title: "Earn from verified kills", body: "Every valid verified kill credits your reward ledger. Claim SOL from the treasury once thresholds are met." },
];

export default function Home() {
  const { config } = usePlayer();
  return (
    <div>
      {/* Hero */}
      <section className="relative grid-backdrop border-b border-base-500">
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-28">
          <div className="chip border-accent/40 bg-accent/10 text-accent mb-6">FPS map platform · Solana mainnet</div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.05]">
            Build maps. Fight on maps.
            <br />
            Earn from <span className="text-accent">verified kills</span>.
          </h1>
          <p className="mt-6 text-lg text-steel max-w-2xl leading-relaxed">
            KillMaps is a browser FPS where creators build combat maps and earn rewards from real verified
            activity. No wagers. No betting. Just maps, players, and kills that count.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/play" className="btn btn-accent px-6 py-3 text-base">
              <Target size={18} /> Play Maps
            </Link>
            <Link to="/create" className="btn px-6 py-3 text-base">
              <Wrench size={18} /> Create Map
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="label mb-8">How it works</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="panel p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-accent font-mono text-sm">0{i + 1}</span>
                <Icon size={20} className="text-steel" />
              </div>
              <h3 className="font-bold text-white mb-1.5">{title}</h3>
              <p className="text-sm text-steel leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reward rules */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="panel p-6 md:p-8">
          <h2 className="text-xl font-bold text-white mb-4">A kill only counts when it's real</h2>
          <div className="grid md:grid-cols-2 gap-x-10 gap-y-2 text-sm text-steel">
            {[
              "Killer and victim are both verified token holders",
              "Killer and victim are different wallets",
              "Match ran long enough and players actually moved",
              "Not an instant kill right after spawn",
              "Same pair isn't farming (cooldown + daily cap)",
              "Creators can't farm their own maps",
              "Map is published and not in test mode",
              "Kills accrue to a ledger — paid in batches, never per-kill on-chain",
            ].map((r) => (
              <div key={r} className="flex items-start gap-2 py-1">
                <span className="text-verify mt-0.5">✓</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
          {config && (
            <div className="mt-6 pt-5 border-t border-base-500 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <Metric label="Verify threshold" value={`${config.minTokens.toLocaleString()} tokens`} />
              <Metric label="Creator unlock" value={`${config.antifarm.creatorMinUniquePlayers} players · ${config.antifarm.creatorMinVerifiedKills} kills`} />
              <Metric label="Network" value={config.cluster} />
              <Metric label="Verification" value={config.verifyLive ? "live" : "mock"} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="stat text-accent">{value}</div>
    </div>
  );
}
