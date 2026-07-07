import { SIDES, useSide, type Side } from "../lib/side";
import { sound } from "../lib/sound";

// Full-screen Bull vs Bear side selection — cosmetic team identity only.
// Shown before entering a match; the choice persists client-side.
export function CharacterSelect({ onChosen }: { onChosen?: (side: Side) => void }) {
  const choose = useSide((s) => s.choose);

  const pick = (side: Side) => {
    sound.ui();
    choose(side);
    onChosen?.(side);
  };

  return (
    <div className="fixed inset-0 z-50 bg-base-900/95 flex flex-col items-center justify-center p-4">
      <div className="label mb-2">Choose your side</div>
      <h2 className="text-3xl md:text-4xl text-white mb-1 text-center">
        <span className="text-verify">BULLS</span> <span className="text-steel">vs</span>{" "}
        <span className="text-[#C89A6A]">BEARS</span>
      </h2>
      <p className="text-steel text-sm mb-8 text-center max-w-md">
        Team identity only — it marks your kills and your name on the battlefield.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {(Object.values(SIDES)).map((s) => (
          <button
            key={s.id}
            onClick={() => pick(s.id)}
            className="group panel p-6 text-left transition-colors hover:border-accent/70"
            style={{ borderTopWidth: 3, borderTopColor: s.color }}
          >
            <div
              className="w-20 h-20 mx-auto mb-4 flex items-center justify-center text-5xl border"
              style={{ background: `${s.color}33`, borderColor: s.color }}
            >
              {s.icon}
            </div>
            <div className="text-2xl text-white text-center mb-2 group-hover:text-accent transition-colors font-display">
              {s.name}
            </div>
            <p className="text-steel text-sm leading-relaxed text-center">{s.description}</p>
            <div className="mt-4 flex justify-center">
              <span className="chip border-base-400 text-steel group-hover:border-accent/60 group-hover:text-accent transition-colors">
                Deploy as {s.name}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Small side badge (icon + name) for HUD / scoreboard rows. */
export function SideBadge({ side, size = "sm" }: { side: Side | null; size?: "sm" | "xs" }) {
  if (!side) return null;
  const s = SIDES[side];
  return (
    <span
      className={`inline-flex items-center gap-1 border px-1.5 ${size === "xs" ? "text-[10px] py-0" : "text-xs py-0.5"}`}
      style={{ borderColor: s.color, background: `${s.color}26` }}
      title={`Fighting for the ${s.name}S`}
    >
      <span>{s.icon}</span>
      <span className="font-semibold tracking-wider">{s.name}</span>
    </span>
  );
}
