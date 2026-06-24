import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

interface Pop {
  id: number;
  x: number;
  y: number;
  z: number;
  value: number;
  head: boolean;
  born: number;
}

export interface DamageHandle {
  add: (pos: [number, number, number], value: number, head: boolean) => void;
}

let counter = 0;

// Floating damage numbers (optional polish). Self-contained so the combat loop never
// re-renders the heavy scene — hits are pushed imperatively and expire after ~0.7s.
export const DamageNumbers = forwardRef<DamageHandle>((_props, ref) => {
  const [pops, setPops] = useState<Pop[]>([]);
  const list = useRef<Pop[]>([]);

  useImperativeHandle(ref, () => ({
    add: (pos, value, head) => {
      const p: Pop = { id: counter++, x: pos[0], y: pos[1], z: pos[2], value, head, born: performance.now() };
      list.current = [...list.current, p].slice(-14);
      setPops(list.current);
    },
  }));

  useFrame(() => {
    const now = performance.now();
    if (list.current.some((p) => now - p.born > 700)) {
      list.current = list.current.filter((p) => now - p.born <= 700);
      setPops(list.current);
    }
  });

  return (
    <>
      {pops.map((p) => {
        const age = (performance.now() - p.born) / 700;
        return (
          <Html key={p.id} position={[p.x, p.y + age * 0.8, p.z]} center distanceFactor={10} zIndexRange={[10, 0]} pointerEvents="none">
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                fontSize: p.head ? 20 : 15,
                color: p.head ? "#ff5a3c" : "#f0d8a8",
                opacity: 1 - age,
                textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                transform: "translateZ(0)",
                userSelect: "none",
              }}
            >
              {p.value}
              {p.head ? "!" : ""}
            </div>
          </Html>
        );
      })}
    </>
  );
});
DamageNumbers.displayName = "DamageNumbers";
