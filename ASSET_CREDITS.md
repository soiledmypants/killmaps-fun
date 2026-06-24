# Asset Credits

KillMaps.fun uses only original, procedurally-generated geometry and permissively
licensed third-party assets. No copyrighted game assets (Counter-Strike, CS:GO, CS2,
Call of Duty, Valorant, Activision, Valve, or any ripped game files) are used.

## In this repo

| Asset | Source | License |
| --- | --- | --- |
| All map geometry (walls, floors, ramps, stairs, crates, cover, barrels, fences, pickups, lights) | Original — generated at runtime with Three.js `BoxGeometry` / `CylinderGeometry` primitives and procedural materials | MIT (this repo) |
| Weapon viewmodels (rifle / pistol / shotgun) | Original — built from Three.js primitives in `client/src/three/Viewmodel.tsx` | MIT (this repo) |
| UI, typography, color system | Original Tailwind theme (`client/tailwind.config.js`) | MIT (this repo) |

## Approved third-party sources (if/when added)

Only assets that are clearly open source / permissive (MIT, Apache-2.0, CC0, public
domain) and cleared for commercial use may be added. Document each one here with its
source URL and license before committing it.

- **Kenney** — https://kenney.nl — CC0
- **Quaternius** — https://quaternius.com — CC0
- **Poly Pizza** — https://poly.pizza — CC0 / CC-BY (attribute per model)
- **three.js examples** — https://github.com/mrdoob/three.js — MIT

## References studied (architecture/UX inspiration only — no assets copied)

- three.js `PointerLockControls` examples — FPS look/movement pattern
- React Three Fiber (`@react-three/fiber`) + drei (`@react-three/drei`)
- pmndrs/ecctrl — character-controller patterns
- Halo Forge / Unity ProBuilder / Roblox Studio — map-editor UX workflow

If a license is ever unclear, the asset is **not** used.
