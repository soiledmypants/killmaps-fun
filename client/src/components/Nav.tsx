import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { usePlayer } from "../lib/player";
import { IdentityModal, VerifyBadge } from "./IdentityModal";
import { Target, Wrench, Coins, Receipt, User } from "./icons";

const links = [
  { to: "/play", label: "Play Maps", icon: Target },
  { to: "/create", label: "Build", icon: Wrench },
  { to: "/dashboard", label: "Dashboard", icon: Coins },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/profile", label: "Profile", icon: User },
];

export function Nav() {
  const { username, player } = usePlayer();
  const [modal, setModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-base-500 bg-base-800/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Target size={20} className="text-accent" />
            <span className="font-bold tracking-tight text-white">
              KillMaps<span className="text-accent">.fun</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-1">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
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

          <button
            className="ml-auto flex items-center gap-2 px-3 py-1.5 border border-base-400 bg-base-700 hover:bg-base-600 transition-colors"
            onClick={() => setModal(true)}
          >
            {player ? <VerifyBadge player={player} /> : null}
            <span className="text-sm font-semibold text-white">{username || "Set identity"}</span>
          </button>
        </div>

        {/* mobile nav */}
        <nav className="md:hidden flex items-center gap-1 px-2 pb-2 overflow-x-auto scroll-thin">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-3 py-1.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 border ${
                  isActive ? "border-accent/60 text-white bg-accent/10" : "border-base-500 text-steel"
                }`
              }
            >
              <Icon size={13} /> {label}
            </NavLink>
          ))}
        </nav>
      </header>
      {modal && <IdentityModal onClose={() => setModal(false)} />}
    </>
  );
}
