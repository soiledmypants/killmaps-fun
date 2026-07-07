# BULLSTRIKE — Architecture (Phase 0)

> **Build maps. Choose your side. Earn from verified kills.**

This document is the Phase 0 deliverable: an audit of the foundation repo and a plan
for what is **reused**, **rebuilt**, and **removed** for BULLSTRIKE. The foundation
repo is **not modified** — BULLSTRIKE is a brand-new repository with its own
infrastructure.

---

## 1. Foundation audit

The foundation is a clean two-package monorepo:

```
client/   React + TS + Vite + React Three Fiber + Tailwind   → Netlify
server/   Node + Express + (Neon Postgres | local JSON)      → Render
```

Backend systems found and their fit for BULLSTRIKE:

| System | File | Verdict |
| --- | --- | --- |
| Pluggable storage (JSON file in dev → Postgres/Neon in prod, in-memory cache, durable `write()`, `flush()` on SIGTERM) | `server/db.js` | **Reuse** (rename table) |
| Backend-only Solana payout layer (keypair from env, MOCK mode when unset, `sendPayout`, `isValidPublicKey`) | `server/solana.js` | **Reuse + extend** (add SPL token-balance verification) |
| Treasury vs. Rewards as separate pools | `server/db.js` / `index.js` | **Reuse** |
| Transaction ledger + `/api/transactions` | `server/index.js` | **Reuse** |
| `/api/config`, `/api/health`, `/api/treasury` | `server/index.js` | **Reuse** |
| Server-authoritative validation (layout hashing, anti-cheat) | `server/gameplay.js` | **Rebuild** as kill/match validation + anti-farm |
| Bounty / funding-session payout-per-event flow | `server/index.js` | **Remove** (BULLSTRIKE is not a wager system) |
| Hardened API client (`ApiError`, JSON-only, clean messages) | `client/src/lib/api.ts` | **Reuse** (new endpoints) |
| Env-driven runtime config (`TOKEN_CA`, treasury, socials) | `client/src/lib/config.ts` | **Reuse** (new defaults) |
| Zustand editor store (place/move/rotate/scale/duplicate/delete, snap, dirty) | `client/src/lib/store.ts` | **Reuse + extend** (FPS asset set, undo/redo) |
| R3F editor scene + asset meshes + minimap | `client/src/three/*`, components | **Rebuild** (forest tactical FPS look) |
| Deploy configs (`render.yaml`, `netlify.toml`, SPA redirect, CORS allow-list) | root | **Reuse** (renamed) |

---

## 2. What is REUSED (patterns, copied & renamed)

- **Storage layer** (`server/db.js`) — identical pluggable design. State shape changes
  (maps + players + matches + kills + reward ledger + transactions). Postgres table
  renamed `bullstrike_state`.
- **Solana payout core** (`server/solana.js`) — `loadKeypair`, `sendPayout`,
  `isValidPublicKey`, MOCK-mode fallback, never-log-secrets discipline. Treasury and
  Creator-Rewards wallets kept as two separate pools.
- **API client shape** (`client/src/lib/api.ts`) — the hardened `request()` wrapper and
  `ApiError` are kept verbatim; only the endpoint surface changes.
- **Runtime config** (`client/src/lib/config.ts`) — env-override pattern kept. **All
  foundation-repo defaults (token CA, treasury wallet, socials) are stripped** so
  BULLSTRIKE never routes funds to another project's infrastructure. Values come from
  env or the $BS defaults.
- **Editor store mechanics** (`client/src/lib/store.ts`) — select/move/rotate/scale/
  duplicate/delete/snap/dirty. Extended with **undo/redo** and the FPS asset catalog.
- **Deploy configs** — `render.yaml` (service `bullstrike-api`, root `server/`,
  `npm start`, health check) and `netlify.toml` (base `client/`, SPA fallback) kept,
  renamed to BULLSTRIKE services.

## 3. What is REBUILT (new for BULLSTRIKE)

- **Token verification** — the foundation verified *deposits*; BULLSTRIKE verifies
  *token holdings*. The backend reads the SPL token balance of a wallet for `TOKEN_CA`
  ($BS mint `G4d2c6XKcN5RnbiCwudfGRaKpCBVVV3skKiEjkQDpump`) on mainnet and checks
  `>= MIN_TOKENS` (250,000). Cached with periodic recheck. MOCK mode (no RPC) returns
  unverified-but-playable.
- **Map data model** — forest FPS arena maps (stone walls / forest floors / dirt ramps /
  log steps / sandbag cover / fallen logs / boulders / foxhole spawns / caches /
  lanterns…), spawn points, lighting settings, plus reward/kill/verified-player stats
  embedded per map.
- **Map builder UI** — tactical, modular-geometry editor (left asset palette in dark
  green / center 3D viewport / right inspector in dark bark brown / top
  save·test·publish bar). Not a voxel toy.
- **Bull vs Bear character selection** — a client-side, cosmetic team identity chosen
  before spawning (Zustand + localStorage). Shown on the HUD, prematch screen and kill
  feed. Does not touch the backend, match pipeline or rewards.
- **Reward ledger + settlement system** — internal SOL ledger (`db.ledger`) credited by
  *valid verified kills*. No per-kill on-chain transfer. Settlements batched from the
  Treasury wallet on a fixed schedule.
- **Anti-farm engine** (`server/antifarm.js`) — per killer/victim pair cooldown + daily
  cap, spawn protection, min match duration, min movement, impossible-rate rejection,
  wallet-cluster self-farm guard, creator unlock thresholds.
- **Match lifecycle** — `start` / `event` / `end`, server-tracked match integrity,
  `kills/record` gated by every anti-farm rule.
- **FPS gameplay** — browser FPS (pointer-lock look, WASD, sprint, jump, crouch,
  shoot/reload, health/damage/death/respawn, kill feed, scoreboard, timer) in a forest
  battlefield with warm golden lighting.

## 4. What is REMOVED (foundation-specific)

- Wager / bounty funding sessions, Solana-Pay deposit QR, unique-dust amount matching,
  deposit-verification bounty flow, "instant payout on win", bounty freeze/expiry/
  refund sweeps. **BULLSTRIKE has no wagers, no betting, no gambling UI.**
- The foundation repo's builders, parkour checkpoints/finish, run validator, and all of
  its branding, wallets, token CA, and social links.

---

## 5. Reward flow (no per-kill on-chain payouts)

```
Verified players fight
  → backend records match events
  → anti-farm decides if a kill counts (see §6)
  → valid kill credits SOL to the creator ledger
  → ledger settles automatically in batches
  → settlements paid from the Treasury wallet
```

A kill counts only if **all** hold: killer verified, victim verified, both hold
≥ 250,000 $BS, killer ≠ victim, match legitimate + long enough, map published and not
in test mode, not instant-after-spawn, pair not farming, creator not farming own map,
backend accepts the match.

## 6. Anti-farm rules (enforced from day one)

Pair cooldown, daily pair cap, min match duration, min movement/distance, spawn-kill
rejection, spawn protection window, impossible accuracy/fire-rate/move-speed/teleport
rejection, wallet-cluster self-farm guard, suspicious-activity logging, reward lockout
for flagged maps and creator unlock thresholds with a clean abuse record.

## 7. Stack & deployment (own infrastructure)

| Layer | Tech | Host |
| --- | --- | --- |
| Frontend | React + TS + Vite + R3F + Tailwind | **Netlify** (bullstrike.fun) |
| Backend | Node + Express | **Render** (`bullstrike-api`) |
| Database | Postgres (`bullstrike_state`) | **Neon** (own DB) |
| Chain | Solana mainnet-beta | own Treasury + Creator-Rewards wallets, own `TOKEN_CA` ($BS) |

Env vars: `DATABASE_URL`, `SOLANA_CLUSTER`, `SOLANA_RPC_URL`, `TOKEN_CA`,
`MIN_TOKENS`, `TREASURY_WALLET_PRIVATE_KEY`, `CREATOR_REWARDS_WALLET_PRIVATE_KEY`,
`FRONTEND_URL` (server); `VITE_API_URL`, `VITE_TOKEN_CA` (client). Private keys are
dashboard-only secrets — never committed.

## 8. Phasing

- **Phase 1 (this MVP):** repo, backend migration, Neon + Solana, token verification,
  player registration + profiles + payout wallet, map save/load, map builder, publish,
  browser, reward ledger, anti-farm foundation, transactions, browser FPS with
  Bull/Bear character selection.
- **Phase 2:** real FPS combat polish + multiplayer netcode.
- **Phase 3:** verified-kill tracking at scale, settlements, full anti-farm enforcement.
- **Phase 4:** spectator, rankings, featured/trending maps, creator leaderboards.

**Success metric:** a creator can build → save → publish → browse a map, and the verified-
kill reward pipeline (with anti-farm) is wired end-to-end, before multiplayer combat is
considered complete.
