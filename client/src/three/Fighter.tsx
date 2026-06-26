import { useMemo, useRef, MutableRefObject, ReactNode } from "react";
import { useFrame, GroupProps } from "@react-three/fiber";
import * as THREE from "three";
import { WeaponModel } from "./WeaponModel";
import type { WeaponId } from "../lib/fps";

// One original jointed humanoid (no ripped models). Limbs are parented at real
// joints so nothing floats. Drives idle-breathe, walk, aim and a death topple from a
// shared mutable state ref so enemies animate without per-frame React renders.

export interface FighterState {
  moving: boolean;
  aiming: boolean;
  dead: boolean;
  deadAt: number;
  phase: number;
}
export function makeFighterState(phase = 0): FighterState {
  return { moving: false, aiming: false, dead: false, deadAt: 0, phase };
}

export interface Palette {
  fatigue: string;
  fatigueDark: string;
  vest: string;
  accent: string;
  helmet: string;
  mask: string;
  glove: string;
  headwrap?: boolean;
}

export const PALETTES: Record<string, Palette> = {
  operator: { fatigue: "#9a8763", fatigueDark: "#7c6a4c", vest: "#2b2722", accent: "#3c352a", helmet: "#6f6047", mask: "#1b1916", glove: "#161310" },
  desert: { fatigue: "#bda978", fatigueDark: "#988450", vest: "#4a3f2c", accent: "#6b5a3a", helmet: "#cdbf9a", mask: "#2a2620", glove: "#1c1813", headwrap: true },
  mercenary: { fatigue: "#5b5347", fatigueDark: "#433d34", vest: "#1f1d1a", accent: "#3a352d", helmet: "#2c2a25", mask: "#141310", glove: "#121110" },
  raider: { fatigue: "#7a4f3a", fatigueDark: "#5d3b2b", vest: "#241b15", accent: "#3e2c20", helmet: "#3a281d", mask: "#120d0a", glove: "#140f0b", headwrap: true },
  militia: { fatigue: "#6e6f4a", fatigueDark: "#54552f", vest: "#2a2a1d", accent: "#3d3d28", helmet: "#454529", mask: "#16160f", glove: "#13130d" },
};

const ENEMY_VARIANTS = ["desert", "mercenary", "raider", "militia"];
export function enemyPalette(i: number): { palette: Palette; weapon: WeaponId } {
  const v = ENEMY_VARIANTS[i % ENEMY_VARIANTS.length];
  const weapons: WeaponId[] = ["ak", "mp5", "m4", "ump"];
  return { palette: PALETTES[v], weapon: weapons[i % weapons.length] };
}

function mat(color: string, rough = 0.85, metal = 0.1) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} />;
}

// Where the weapon sits in the operator's hands. Shared by the in-game body and the
// loadout preview so an injected (animated) weapon lines up exactly with the default.
const WEAPON_POS: [number, number, number] = [0.02, -0.4, 0.34];
const WEAPON_ROT: [number, number, number] = [0.05, Math.PI / 2, -0.12];
const WEAPON_SCALE = 0.92;

export function Fighter({
  palette = PALETTES.operator,
  weapon = "m4",
  stateRef,
  weaponNode,
  ...props
}: GroupProps & {
  palette?: Palette;
  weapon?: WeaponId | null;
  stateRef?: MutableRefObject<FighterState>;
  // Optional override for the held weapon (e.g. an animated swap in the loadout
  // preview). Rendered at the same hand transform as the default WeaponModel.
  weaponNode?: ReactNode;
}) {
  const internal = useRef<FighterState>(makeFighterState());
  const st = stateRef || internal;
  const p = palette;

  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const arms = useRef<THREE.Group>(null);

  const fall = useMemo(() => new THREE.Vector3(), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime + st.current.phase;
    const stt = st.current;

    // ---- death topple ----
    if (stt.dead) {
      const k = Math.min(1, (performance.now() - stt.deadAt) / 650);
      if (root.current) {
        root.current.rotation.x = -k * (Math.PI / 2 - 0.1);
        root.current.position.y = (props.position as any)?.[1] ?? 0;
      }
      if (torso.current) torso.current.rotation.z = k * 0.3;
      if (armL.current) armL.current.rotation.x = -k * 1.2;
      if (armR.current) armR.current.rotation.x = -k * 0.6;
      return;
    }
    if (root.current) root.current.rotation.x = 0;

    // ---- walk / idle ----
    const walk = stt.moving ? 1 : 0;
    const sw = Math.sin(t * (stt.moving ? 9 : 1.6));
    if (legL.current) legL.current.rotation.x = sw * 0.5 * walk;
    if (legR.current) legR.current.rotation.x = -sw * 0.5 * walk;
    if (torso.current) {
      torso.current.position.y = 0.05 + Math.abs(sw) * 0.03 * walk + (walk ? 0 : Math.sin(t * 1.6) * 0.012);
      torso.current.rotation.z = (walk ? 0 : Math.sin(t * 0.7) * 0.01);
    }
    if (arms.current) {
      // raise weapon when aiming, low-ready otherwise
      const target = stt.aiming ? -0.5 : -0.05;
      arms.current.rotation.x += (target - arms.current.rotation.x) * 0.2;
    }
    if (head.current) head.current.rotation.y = stt.aiming ? 0 : Math.sin(t * 0.45) * 0.18;
    fall.set(0, 0, 0);
  });

  return (
    <group ref={root} {...props}>
      {/* hips */}
      <group position={[0, 0.92, 0]}>
        <mesh castShadow position={[0, 0, 0]}>
          <boxGeometry args={[0.34, 0.2, 0.22]} />
          {mat(p.fatigueDark)}
        </mesh>
        <mesh castShadow position={[0, 0.02, 0.01]}>
          <boxGeometry args={[0.37, 0.07, 0.24]} />
          {mat(p.accent, 0.7)}
        </mesh>

        {/* legs */}
        {([-1, 1] as const).map((side) => (
          <group key={side} ref={side === -1 ? legL : legR} position={[0.1 * side, -0.06, 0]}>
            <mesh castShadow position={[0, -0.22, 0]}>
              <boxGeometry args={[0.16, 0.45, 0.18]} />
              {mat(p.fatigue)}
            </mesh>
            <mesh castShadow position={[0, -0.43, 0.06]}>
              <boxGeometry args={[0.155, 0.1, 0.08]} />
              {mat(p.accent, 0.6, 0.2)}
            </mesh>
            <mesh castShadow position={[0, -0.66, 0]}>
              <boxGeometry args={[0.145, 0.42, 0.16]} />
              {mat(p.fatigueDark)}
            </mesh>
            <mesh castShadow position={[0, -0.9, 0.05]}>
              <boxGeometry args={[0.16, 0.14, 0.3]} />
              {mat(p.glove, 0.6)}
            </mesh>
          </group>
        ))}

        {/* torso */}
        <group ref={torso} position={[0, 0.05, 0]}>
          <mesh castShadow position={[0, 0.3, 0]}>
            <boxGeometry args={[0.4, 0.5, 0.23]} />
            {mat(p.fatigue)}
          </mesh>
          {/* plate carrier */}
          <mesh castShadow position={[0, 0.3, 0.02]}>
            <boxGeometry args={[0.44, 0.44, 0.28]} />
            {mat(p.vest, 0.6, 0.25)}
          </mesh>
          {[-0.11, 0.11].map((x) => (
            <mesh key={x} castShadow position={[x, 0.24, 0.16]}>
              <boxGeometry args={[0.13, 0.15, 0.07]} />
              {mat(p.accent, 0.7, 0.2)}
            </mesh>
          ))}
          {[-0.12, 0.12].map((x) => (
            <mesh key={x} castShadow position={[x, 0.5, 0.07]}>
              <boxGeometry args={[0.08, 0.16, 0.16]} />
              {mat(p.accent, 0.7)}
            </mesh>
          ))}

          {/* arms group (raises to aim) */}
          <group ref={arms} position={[0, 0.42, 0.0]}>
            {([-1, 1] as const).map((side) => (
              <group key={side} ref={side === -1 ? armL : armR} position={[0.26 * side, 0, 0]}>
                <mesh castShadow position={[0, 0, 0]}>
                  <boxGeometry args={[0.14, 0.15, 0.18]} />
                  {mat(p.vest, 0.7, 0.2)}
                </mesh>
                <mesh castShadow position={[0.01 * side, -0.2, 0.08]} rotation={[0.55, 0, 0.12 * side]}>
                  <boxGeometry args={[0.115, 0.3, 0.12]} />
                  {mat(p.fatigue)}
                </mesh>
                <mesh castShadow position={[-0.05 * side, -0.34, 0.26]} rotation={[1.2, 0, 0.5 * side]}>
                  <boxGeometry args={[0.1, 0.28, 0.11]} />
                  {mat(p.fatigueDark)}
                </mesh>
                <mesh castShadow position={[-0.11 * side, -0.44, 0.34]}>
                  <boxGeometry args={[0.09, 0.1, 0.12]} />
                  {mat(p.glove, 0.9)}
                </mesh>
              </group>
            ))}
            {weaponNode ? (
              <group position={WEAPON_POS} rotation={WEAPON_ROT} scale={WEAPON_SCALE}>{weaponNode}</group>
            ) : weapon ? (
              <WeaponModel weaponId={weapon} position={WEAPON_POS} rotation={WEAPON_ROT} scale={WEAPON_SCALE} />
            ) : null}
          </group>

          {/* neck + head */}
          <group ref={head} position={[0, 0.62, 0]}>
            <mesh castShadow position={[0, -0.05, 0]}>
              <cylinderGeometry args={[0.07, 0.08, 0.1, 8]} />
              {mat(p.mask, 0.8)}
            </mesh>
            {/* head / balaclava */}
            <mesh castShadow position={[0, 0.08, 0]}>
              <boxGeometry args={[0.21, 0.25, 0.23]} />
              {mat(p.mask, 0.85)}
            </mesh>
            {/* head wrap or helmet */}
            {p.headwrap ? (
              <mesh castShadow position={[0, 0.16, 0]}>
                <boxGeometry args={[0.25, 0.14, 0.26]} />
                {mat(p.helmet, 0.9)}
              </mesh>
            ) : (
              <>
                <mesh castShadow position={[0, 0.18, 0]}>
                  <boxGeometry args={[0.25, 0.15, 0.27]} />
                  {mat(p.helmet, 0.55, 0.3)}
                </mesh>
                <mesh castShadow position={[0, 0.13, 0.12]}>
                  <boxGeometry args={[0.26, 0.06, 0.06]} />
                  {mat(p.helmet, 0.55, 0.3)}
                </mesh>
              </>
            )}
            {/* single narrow tactical visor slit — no eyeballs, clean operator look */}
            <group position={[0, 0.085, 0.115]}>
              {/* recessed dark slit opening */}
              <mesh>
                <boxGeometry args={[0.2, 0.045, 0.03]} />
                <meshStandardMaterial color="#0b0c0e" roughness={0.95} />
              </mesh>
              {/* subtle tan/gray highlight bar inside the slit */}
              <mesh position={[0, 0, 0.012]}>
                <boxGeometry args={[0.18, 0.018, 0.01]} />
                <meshStandardMaterial color="#8a8472" roughness={0.4} metalness={0.2} emissive="#15140f" emissiveIntensity={0.3} />
              </mesh>
              {/* brow line above the slit (mask) */}
              <mesh position={[0, 0.035, 0.004]}>
                <boxGeometry args={[0.21, 0.028, 0.04]} />
                {mat(p.mask, 0.85)}
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
