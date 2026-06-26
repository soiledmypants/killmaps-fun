# KillMaps.fun

**Build maps. Fight on maps. Earn from verified kills.**

A browser FPS platform where creators build tactical combat maps and earn rewards from
**real verified activity** — not wagers. Verified token holders fight on published maps;
every valid verified kill credits the creator's reward ledger, claimable in batches from
the treasury. Anti-farming is enforced from day one.

> This is **not** a wager system. No betting, no gambling. Creators earn from players;
> players earn from verified kills.

**Solana mainnet-beta.**

- Token: **$CS** — CA `8Ac6NUTzfk5FoC2VZ7fYkqFgZ6kBcKa9aaexAoAwpump`
- Verification: hold ≥ 250,000 **$CS** (real on-chain SPL balance check on mainnet-beta).
- Live site: https://counterstrikepf.fun
- X / Twitter: https://x.com/CounterStrikePF

## Stack
- **client/** — React + TypeScript + Vite + React Three Fiber + Three.js + Tailwind.
  Full 3D map builder, single-player FPS prototype, dashboards.
- **server/** — Node + Express + Neon/Postgres (or local JSON in dev). Token verification,
  match/kill pipeline, anti-farm engine, reward ledger, batched claim payouts.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the Phase 0 audit (what was reused / rebuilt /
removed from the Boss.fun / `course-fun` foundation) and [ASSET_CREDITS.md](ASSET_CREDITS.md).

## Run it

```bash
npm run install:all     # installs root, client, server deps
npm run dev             # server (:9001) + client (:5173)
```

Open http://localhost:5173. With no RPC/keys configured the server runs in **MOCK mode**:
you can build, publish, and play; token verification reports "unverified" and payouts are
recorded but not sent on-chain — so the full UX is testable offline.

## The loop
1. **Identity** — enter a username + Solana payout wallet (no wallet connect). Holding
   ≥ 250,000 **$CS** makes you a **verified** player whose kills generate rewards.
2. **Build** — `/create` is a tactical map editor: walls, floors, ramps, stairs, platforms,
   cover, crates, barrels, fences, doors, windows, spawns/team spawns, weapon/ammo/health
   pickups and lights. Move/rotate/scale gizmos, snap-to-grid, undo/redo, duplicate, delete.
   Save → publish. Maps persist as JSON.
3. **Play** — `/play` browses published maps; drop into a browser FPS (WASD, mouse look,
   sprint, jump, crouch, shoot, reload, weapon swap) with health, respawn, kill feed,
   scoreboard and a match timer. Phase 1 ships single-player vs. target dummies to exercise
   the pipeline; real multiplayer combat is Phase 2.
4. **Earn** — valid verified kills credit your **reward ledger**. The Creator Dashboard
   shows verified kills, unique players, and claimable SOL. Claims unlock at **50 unique
   verified players + 250 verified kills** per map and are paid in batches from the treasury.

## A kill only counts when it's real (anti-farm)
Killer and victim both verified, different wallets, match long enough, players actually
moved, not an instant spawn kill, pair cooldown + daily cap respected, creator can't farm
their own map, map published and not in test mode, impossible fire-rate/accuracy/speed
rejected. Suspicious kills are logged. **Rewards never pay per-kill on-chain** — points
accrue to a ledger and are claimed in batches (prevents spam, farming, and treasury drain).

## API
`GET /api/config · GET /api/health · POST /api/players/register · POST /api/players/verify ·
GET /api/players/:wallet · GET/POST/PUT/DELETE /api/maps[/:id] · POST /api/maps/:id/publish ·
POST /api/matches/start · POST /api/matches/:id/event · POST /api/matches/:id/end ·
POST /api/kills/record · GET /api/rewards/:wallet · POST /api/rewards/claim ·
GET /api/transactions · GET /api/leaderboard · GET /api/treasury`

## Deploy (own infrastructure — separate from Boss.fun)
- **Backend → Render** from [`render.yaml`](render.yaml) (service `killmaps-api`, root
  `server/`, `npm start`, health `/api/health`). Set the secrets below in the dashboard.
- **Frontend → Netlify** from [`netlify.toml`](netlify.toml) (base `client/`, publish
  `client/dist`, SPA fallback). Set `VITE_API_URL` to the Render URL.

| Server env | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon/managed Postgres (Render disk is ephemeral) |
| `SOLANA_RPC_URL` | paid mainnet RPC (Helius/QuickNode/Triton) — required for verification + payouts |
| `TOKEN_CA` | the pump.fun token mint players must hold (`8Ac6NUTzfk5FoC2VZ7fYkqFgZ6kBcKa9aaexAoAwpump`) |
| `MIN_TOKENS` | verification threshold (default 250000) |
| `TREASURY_WALLET_PRIVATE_KEY` | funds player payouts |
| `CREATOR_REWARDS_WALLET_PRIVATE_KEY` | funds creator reward claims |
| `FRONTEND_URL` | Netlify origin(s), comma-separated, for CORS |

Client env: `VITE_API_URL`, `VITE_TOKEN_CA` (display).

## Security
Private keys are read only from `process.env`, never returned by any API or logged. Kill
validation and all payouts happen server-side. Treasury and Creator-Rewards are separate
pools persisted to Postgres.

## Phasing
**Phase 1 (this MVP):** repo, backend migration, token verification, profiles, map
builder + publish + browse, reward ledger, anti-farm foundation, transactions,
single-player FPS prototype. **Phase 2:** multiplayer FPS combat. **Phase 3:** verified-kill
tracking at scale + reward enforcement. **Phase 4:** spectator, rankings, featured/trending,
creator leaderboards.
