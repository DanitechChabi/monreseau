import { motion, useMotionValue, useSpring } from "motion/react";
import type { ReactNode } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { MQ } from "./gsap";

/** Bouton « magnétique » : suit légèrement le pointeur (souris uniquement). */
export function Magnetic({ children, strength = 0.28, className }: { children: ReactNode; strength?: number; className?: string }) {
  const enabled = useMediaQuery(MQ.finePointer);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 });

  if (!enabled) return <span className={`inline-flex ${className ?? ""}`}>{children}</span>;
  return (
    <motion.span
      className={`inline-flex ${className ?? ""}`}
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}
