import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import type { GameMap } from "../lib/types";
import { MapThumb } from "../components/MapThumb";
import { shortWallet } from "../lib/config";
import { Target, Play, Wrench } from "../components/icons";

const SORTS = [
  { id: "trending", label: "Trending" },
  { id: "kills", label: "Most Kills" },
  { id: "players", label: "Most Players" },
  { id: "newest", label: "Newest" },
  { id: "rewards", label: "Highest Rewards" },
];

export default function PlayMaps() {
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [sort, setSort] = useState("trending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .listMaps({ published: true, sort })
      .then((m) => {
        setMaps(m);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load maps"))
      .finally(() => setLoading(false));
  }, [sort]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target size={22} className="text-accent" /> Play Maps
          </h1>
          <p className="text-steel text-sm mt-1">Published combat maps. Verified kills here generate creator rewards.</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border ${
                sort === s.id ? "border-accent/60 bg-accent/10 text-accent" : "border-base-500 text-steel hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="panel p-4 text-kill text-sm mb-4">{error}</div>}

      {loading ? (
        <div className="text-steel text-sm py-20 text-center">Loading maps…</div>
      ) : maps.length === 0 ? (
        <div className="panel p-12 text-center">
          <p className="text-steel mb-4">No published maps yet. Be the first to build one.</p>
          <Link to="/create" className="btn btn-accent">
            <Wrench size={16} /> Create a map
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {maps.map((m) => (
            <div key={m.map_id} className="panel overflow-hidden group">
              <div className="relative aspect-video bg-base-900 border-b border-base-500">
                <MapThumb map={m} className="w-full h-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-base-900/80 to-transparent" />
                <span className="absolute top-2 right-2 chip border-base-500 bg-base-900/70 font-mono text-steel">
                  <span className={`w-1.5 h-1.5 rounded-full ${(m.active_players ?? 0) > 0 ? "bg-verify animate-pulse" : "bg-base-400"}`} />
                  {m.active_players ?? 0} / {m.max_players ?? 16}
                </span>
                <Link
                  to={`/play/${m.map_id}`}
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-base-900/40"
                >
                  <span className="btn btn-accent">
                    <Play size={16} /> Play
                  </span>
                </Link>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-white truncate">{m.title || "Untitled"}</h3>
                </div>
                <p className="text-xs text-steel mt-0.5">by {m.creator_username || shortWallet(m.creator)}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Kills" value={m.stats.verified_kills} />
                  <Stat label="Players" value={m.stats.unique_verified_players} />
                  <Stat label="Plays" value={m.stats.plays} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-base-500 bg-base-800 py-1.5">
      <div className="stat text-accent text-sm">{value}</div>
      <div className="label text-[9px]">{label}</div>
    </div>
  );
}
