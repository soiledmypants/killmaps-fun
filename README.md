# BULLSTRIKE

**Build maps. Choose your side. Earn from verified kills.**

A browser FPS platform where creators build tactical forest combat maps and earn rewards
from **real verified activity** — not wagers. Verified token holders pick **Bull or Bear**
and fight on published maps; every valid verified kill credits the creator's reward
ledger, settled in batches from the treasury. Anti-farming is enforced from day one.

> This is **not** a wager system. No betting, no gambling. Creators earn from players;
> players earn from verified kills.

**Solana mainnet-beta.**

- Token: **$BS** — CA `G4d2c6XKcN5RnbiCwudfGRaKpCBVVV3skKiEjkQDpump`
- Verification: hold ≥ 250,000 **$BS** (real on-chain SPL balance check on mainnet-beta).
- Live site: https://bullstrike.fun
- X / Twitter: https://x.com/BULLSTRIKE_FUN

## Stack
- **client/** — React + TypeScript + Vite + React Three Fiber + Three.js + Tailwind.
  Full 3D map builder, browser FPS, Bull/Bear character selection, dashboards.
- **server/** — Node + Express + Neon/Postgres (or local JSON in dev). Token verification,
  match/kill pipeline, anti-farm engine, reward ledger, batched settlements.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the Phase 0 audit (what was reused / rebuilt /
removed from the foundation repo) and [ASSET_CREDITS.md](ASSET_CREDITS.md).

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
   ≥ 250,000 **$BS** makes you a **verified** player whose kills generate rewards.
2. **Choose your side** — before deploying, pick **🐂 BULL** or **🐻 BEAR**. Cosmetic
   team identity only: it marks your name on the HUD and prefixes your kills in the feed.
3. **Build** — `/create` is a forest map editor: stone walls, forest floors, dirt ramps,
   log steps, timber platforms, sandbag cover, fallen logs, boulders, fences, doorways,
   firing slits, foxhole spawns, weapon/ammo/medkit caches and camp lanterns.
   Move/rotate/scale gizmos, snap-to-grid, undo/redo, duplicate, delete. Save → publish.
4. **Play** — `/play` browses published maps; drop into a browser FPS (WASD, mouse look,
   sprint, jump, crouch, shoot, reload, weapon swap) with health, respawn, kill feed,
   scoreboard and a match timer against real players and practice NPCs.
5. **Earn** — valid verified kills credit your **reward ledger** in SOL. The Creator
   Dashboard shows validated kills, unique players, and pending rewards. The ledger
   settles automatically in batches from the treasury — never per kill.

## A kill only counts when it's real (anti-farm)
Killer and victim both verified, different wallets, match long enough, players actually
moved, not an instant spawn kill, pair cooldown + daily cap respected, creator can't farm
their own map, map published and not in test mode, impossible fire-rate/accuracy/speed
rejected. Suspicious kills are logged. **Rewards never pay per-kill on-chain** — they
accrue to a ledger and settle in batches (prevents spam, farming, and treasury drain).

## API
`GET /api/config · GET /api/health · POST /api/players/register · POST /api/players/verify ·
GET /api/players/:wallet · GET/POST/PUT/DELETE /api/maps[/:id] · POST /api/maps/:id/publish ·
POST /api/matches/start · POST /api/matches/:id/event · POST /api/matches/:id/end ·
POST /api/kills/record · GET /api/rewards/:wallet · POST /api/rewards/claim ·
GET /api/transactions · GET /api/leaderboard · GET /api/treasury`

## Deploy (own infrastructure)
- **Backend → Render** from [`render.yaml`](render.yaml) (service `bullstrike-api`, root
  `server/`, `npm start`, health `/api/health`). Set the secrets below in the dashboard.
- **Frontend → Netlify** from [`netlify.toml`](netlify.toml) (base `client/`, publish
  `client/dist`, SPA fallback). Set `VITE_API_URL` to the Render URL and point the
  `bullstrike.fun` custom domain at Netlify.

| Server env | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon/managed Postgres (Render disk is ephemeral) |
| `SOLANA_RPC_URL` | paid mainnet RPC (Helius/QuickNode/Triton) — required for verification + payouts |
| `SOLANA_CLUSTER` | `mainnet-beta` |
| `TOKEN_CA` | the $BS pump.fun token mint players must hold (`G4d2c6XKcN5RnbiCwudfGRaKpCBVVV3skKiEjkQDpump`) |
| `MIN_TOKENS` | verification threshold (default 250000) |
| `TREASURY_WALLET_PRIVATE_KEY` | signs all creator reward settlements + player payouts (dashboard-only secret) |
| `CREATOR_REWARDS_WALLET_PRIVATE_KEY` | dev/rewards wallet, separate from the treasury (dashboard-only secret) |
| `FRONTEND_URL` | `https://bullstrike.fun` (+ Netlify origin, comma-separated) for CORS |

Client env: `VITE_API_URL` (Render backend URL, e.g. `https://bullstrike-api.onrender.com`),
`VITE_TOKEN_CA` (display — same $BS mint as `TOKEN_CA`).

## Security
Private keys are read only from `process.env`, never committed to the repo, never returned
by any API and never logged. Kill validation and all payouts happen server-side. Treasury
and Creator-Rewards are separate pools persisted to Postgres (`bullstrike_state`).

## Phasing
**Phase 1 (this MVP):** repo, backend migration, token verification, profiles, map
builder + publish + browse, reward ledger, anti-farm foundation, transactions, browser
FPS with Bull/Bear selection. **Phase 2:** multiplayer FPS combat polish. **Phase 3:**
verified-kill tracking at scale + reward enforcement. **Phase 4:** spectator, rankings,
featured/trending, creator leaderboards.
