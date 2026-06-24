import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { usePlayer } from "../lib/player";
import { SOCIALS } from "../lib/config";
import { IdentityModal, VerifyBadge } from "./IdentityModal";
import { Target, Wrench, Shield, Globe, Coins, Receipt, User, X } from "./icons";

const links = [
  { to: "/", label: "Play", icon: Target, end: true },
  { to: "/create", label: "Build", icon: Wrench },
  { to: "/loadout", label: "Loadout", icon: Shield },
  { to: "/play", label: "Maps", icon: Globe },
  { to: "/dashboard", label: "Dashboard", icon: Coins },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/profile", label: "Profile", icon: User },
];

export function DevModeBadge({ className = "" }: { className?: string }) {
  const config = usePlayer((s) => s.config);
  if (!config?.devVerifyOff) return null;
  return (
    <span className={`chip border-accent/60 bg-accent/15 text-accent animate-pulse ${className}`}>
      DEV MODE — TOKEN VERIFY OFF
    </span>
  );
}

export function Nav({ overlay = false }: { overlay?: boolean }) {
  const { username, player } = usePlayer();
  const [modal, setModal] = useState(false);

  return (
    <>
      <header
        className={
          overlay
            ? "absolute top-0 inset-x-0 z-40"
            : "sticky top-0 z-40 border-b border-base-500 bg-base-800/90 backdrop-blur"
        }
      >
        <div className={`mx-auto max-w-7xl px-4 h-14 flex items-center gap-6 ${overlay ? "bg-gradient-to-b from-base-900/80 to-transparent" : ""}`}>
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Target size={20} className="text-accent" />
            <span className="font-bold tracking-tight text-white">
              Pump<span className="text-accent">Strike</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm font-semibold uppercase tracking-wider flex items-center gap-2 border-b-2 -mb-px transition-colors ${
                    isActive ? "border-accent text-white" : "border-transparent text-steel hover:text-white"
                  }`
                }
              >
                <Icon size={15} /> {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <DevModeBadge className="hidden lg:inline-flex" />
            {SOCIALS.twitter && (
              <a href={SOCIALS.twitter} target="_blank" rel="noreferrer" title="@PumpStrike_Fun on X" className="w-8 h-8 flex items-center justify-center border border-base-400 bg-base-700/80 text-steel hover:text-white hover:bg-base-600 transition-colors">
                <X size={15} />
              </a>
            )}
            <button
              className="flex items-center gap-2 px-3 py-1.5 border border-base-400 bg-base-700/80 hover:bg-base-600 transition-colors backdrop-blur"
              onClick={() => setModal(true)}
            >
              {player ? <VerifyBadge player={player} /> : null}
              <span className="text-sm font-semibold text-white">{username || "Set identity"}</span>
            </button>
          </div>
        </div>

        {!overlay && (
          <nav className="md:hidden flex items-center gap-1 px-2 pb-2 overflow-x-auto scroll-thin">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 border whitespace-nowrap ${
                    isActive ? "border-accent/60 text-white bg-accent/10" : "border-base-500 text-steel"
                  }`
                }
              >
                <Icon size={13} /> {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      {modal && <IdentityModal onClose={() => setModal(false)} />}
    </>
  );
}
