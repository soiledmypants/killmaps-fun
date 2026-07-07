import { SOCIALS, SITE_URL, TICKER_TAG } from "../lib/config";
import { X } from "./icons";

export function Footer() {
  return (
    <footer className="border-t border-base-500 bg-base-800/80 mt-10">
      <div className="mx-auto max-w-7xl px-4 py-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">🐂</span>
          <span className="font-display text-white tracking-wide">
            BULL<span className="text-accent">STRIKE</span>
          </span>
          <span className="text-[10px] font-bold text-accent border border-accent/40 bg-accent/10 px-1.5 py-0.5 leading-none">{TICKER_TAG}</span>
        </div>
        <div className="flex items-center gap-4 text-xs uppercase tracking-wider text-steel">
          <a href={SOCIALS.twitter} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-accent">
            <X size={13} /> @BULLSTRIKE_FUN
          </a>
          <a href={SITE_URL} className="hover:text-accent">bullstrike.fun</a>
        </div>
        <p className="text-[11px] text-steel/60 w-full sm:w-auto">
          Bulls vs Bears — tactical combat in the forest. No wagers, no betting.
        </p>
      </div>
    </footer>
  );
}
