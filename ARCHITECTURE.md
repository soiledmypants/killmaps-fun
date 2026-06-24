# KillMaps.fun — Architecture (Phase 0)

> **Build maps. Get players. Earn from verified kills.**

This document is the Phase 0 deliverable: an audit of the foundation repo
(`course-fun` / Boss.fun) and a plan for what is **reused**, **rebuilt**, and
**removed** for KillMaps.fun. The Boss.fun / course-fun repos are **not modified** —
KillMaps.fun is a brand-new repository with its own infrastructure.

---

## 1. Foundation audit (course-fun / Boss.fun)

The foundation is a clean two-package monorepo:

```
client/   React + TS + Vite + React Three Fiber + Tailwind   → Netlify
server/   Node + Express + (Neon Postgres | local JSON)      → Render
```

Backend systems found and their fit for KillMaps:

| System | File | Verdict |
| --- | --- | --- |
| Pluggable storage (JSON file in dev → Postgres/Neon in prod, in-memory cache, durable `write()`, `flush()` on SIGTERM) | `server/db.js` | **Reuse** (rename table) |
| Backend-only Solana payout layer (keypair from env, MOCK mode when unset, `sendPayout`, `verifyDeposit`, `isValidPublicKey`) | `server/solana.js` | **Reuse + extend** (add SPL token-balance verification) |
| Treasury vs. Rewards as separate pools | `server/db.js` / `index.js` | **Reuse** |
| Transaction ledger + `/api/transactions` | `server/index.js` | **Reuse** |
| `/api/config`, `/api/health`, `/api/treasury` | `server/index.js` | **Reuse** |
| Server-authoritative validation (`validateRun`, layout hashing, anti-cheat) | `server/gameplay.js` | **Rebuild** as kill/match validation + anti-farm |
| Bounty / funding-session / "beat the boss" payout-per-event flow | `server/index.js` | **Remove** (KillMaps is not a wager system) |
| Hardened API client (`ApiError`, JSON-only, clean messages) | `client/src/lib/api.ts` | **Reuse** (new endpoints) |
| Env-driven runtime config (`TOKEN_CA`, treasury, socials) | `client/src/lib/config.ts` | **Reuse** (new defaults) |
| Zustand editor store (place/move/rotate/scale/duplicate/delete, snap, dirty) | `client/src/lib/store.ts` | **Reuse + extend** (FPS asset set, undo/redo) |
| R3F editor scene + asset meshes + minimap | `client/src/three/*`, components | **Rebuild** (tactical FPS look, not parkour/voxel) |
| Deploy configs (`render.yaml`, `netlify.toml`, SPA redirect, CORS allow-list) | root | **Reuse** (renamed) |

---

## 2. What is REUSED (patterns, copied & renamed)

- **Storage layer** (`server/db.js`) — identical pluggable design. State shape changes
  (maps + players + matches + kills + reward ledger + transactions instead of
  maps + bounties + funding sessions). Postgres table renamed `killmaps_state`.
- **Solana payout core** (`server/solana.js`) — `loadKeypair`, `sendPayout`,
  `isValidPublicKey`, MOCK-mode fallback, never-log-secrets discipline. Treasury and
  Creator-Rewards wallets kept as two separate pools.
- **API client shape** (`client/src/lib/api.ts`) — the hardened `request()` wrapper and
  `ApiError` are kept verbatim; only the endpoint surface changes.
- **Runtime config** (`client/src/lib/config.ts`) — env-override pattern kept. **All
  Boss.fun defaults (token CA, treasury wallet, socials) are stripped** so KillMaps never
  routes funds to Boss.fun infrastructure. Values come from env or are empty.
- **Editor store mechanics** (`client/src/lib/store.ts`) — select/move/rotate/scale/
  duplicate/delete/snap/dirty. Extended with **undo/redo** and the FPS asset catalog.
- **Deploy configs** — `render.yaml` (root `server/`, `npm start`, health check) and
  `netlify.toml` (base `client/`, SPA fallback) kept, renamed to KillMaps services.

## 3. What is REBUILT (new for KillMaps)

- **Token verification** — Boss.fun verified *deposits*; KillMaps verifies *token
  holdings*. New `server/verify.js` reads the SPL token balance of a wallet for
  `TOKEN_CA` on mainnet and checks `>= MIN_TOKENS` (250,000). Cached with periodic
  recheck. MOCK mode (no RPC) returns unverified-but-playable.
- **Map data model** — FPS arena maps (walls/floors/ramps/stairs/cover/spawns/team
  spawns/pickups/lights/barrels…), spawn points, lighting settings, plus reward/kill/
  verified-player stats embedded per map.
- **Map builder UI** — tactical, modular-geometry editor (left asset palette / center 3D
  viewport / right inspector / top save·test·publish bar). Not a voxel toy.
- **Reward ledger + claim system** — internal points ledger (`db.ledger`) credited by
  *valid verified kills*. No per-kill on-chain transfer. Creators/players claim once
  thresholds are met; payouts batched from Treasury / Creator-Rewards wallet.
- **Anti-farm engine** (`server/antifarm.js`) — per killer/victim pair cooldown + daily
  cap, spawn protection, min match duration, min movement, impossible-rate rejection,
  wallet-cluster self-farm guard, creator unlock thresholds (50 unique verified players,
  250 verified kills).
- **Match lifecycle** — `start` / `event` / `end`, server-tracked match integrity,
  `kills/record` gated by every anti-farm rule.
- **FPS gameplay** — browser FPS prototype (pointer-lock look, WASD, sprint, jump,
  crouch, shoot/reload, health/damage/death/respawn, kill feed, scoreboard, timer).
  Phase-1 single-player vs. target dummies to exercise the verified-kill pipeline;
  real-time multiplayer is deferred.

## 4. What is REMOVED (Boss.fun-specific)

- Wager / bounty funding sessions, Solana-Pay deposit QR, unique-dust amount matching,
  `verifyDeposit` bounty flow, "beat the boss → instant payout", bounty freeze/expiry/
  refund sweeps. **KillMaps has no wagers, no betting, no gambling UI.**
- Boss workshop / robot-part builder, parkour checkpoints/finish, the parkour run
  validator, and all Boss.fun branding, wallets, token CA, and social links.

---

## 5. Reward flow (no per-kill on-chain payouts)

```
Verified players fight
  → backend records match events
  → anti-farm decides if a kill counts (see §6)
  → valid kill credits points to creator ledger (+ optional player ledger)
  → rewards become CLAIMABLE only after thresholds
  → claims paid in batches from Treasury / Creator-Rewards wallet
```

A kill counts only if **all** hold: killer verified, victim verified, both hold
≥ 250,000 tokens, killer ≠ victim, match legitimate + long enough, map published and not
in test mode, not instant-after-spawn, pair not farming, creator not farming own map,
backend accepts the match.

## 6. Anti-farm rules (enforced from day one)

Pair cooldown, daily pair cap, min match duration, min movement/distance, spawn-kill
rejection, spawn protection window, impossible accuracy/fire-rate/move-speed/teleport
rejection, wallet-cluster self-farm guard, suspicious-activity logging, reward lockout
for flagged maps. **Creator rewards unlock requires ≥ 50 unique verified players AND
≥ 250 verified kills AND a clean abuse record.**

## 7. Stack & deployment (separate from Boss.fun)

| Layer | Tech | Host |
| --- | --- | --- |
| Frontend | React + TS + Vite + R3F + Tailwind | **Netlify** (own site) |
| Backend | Node + Express | **Render** (`killmaps-api`) |
| Database | Postgres | **Neon** (own DB) |
| Chain | Solana mainnet-beta | own Treasury + Creator-Rewards wallets, own `TOKEN_CA` |

Env vars: `DATABASE_URL`, `SOLANA_CLUSTER`, `SOLANA_RPC_URL`, `TOKEN_CA`,
`MIN_TOKENS`, `TREASURY_WALLET_PRIVATE_KEY`, `CREATOR_REWARDS_WALLET_PRIVATE_KEY`,
`FRONTEND_URL` (server); `VITE_API_URL`, `VITE_TOKEN_CA` (client).

## 8. Phasing

- **Phase 1 (this MVP):** repo, backend migration, Neon + Solana, token verification,
  player registration + profiles + payout wallet, map save/load, map builder, publish,
  browser, reward ledger, anti-farm foundation, transactions, single-player FPS prototype.
- **Phase 2:** real FPS combat polish + multiplayer netcode.
- **Phase 3:** verified-kill tracking at scale, creator/player reward claims, full
  anti-farm enforcement.
- **Phase 4:** spectator, rankings, featured/trending maps, creator leaderboards.

**Success metric:** a creator can build → save → publish → browse a map, and the verified-
kill reward pipeline (with anti-farm) is wired end-to-end, before multiplayer combat is
considered complete.
