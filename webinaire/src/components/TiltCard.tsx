import { motion, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import type { ReactNode } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { MQ } from "../motion/gsap";

/** Carte inclinée en 3D sous la souris, avec un reflet qui suit le pointeur. */
export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const enabled = useMediaQuery(MQ.finePointer);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const srx = useSpring(rx, { stiffness: 180, damping: 18 });
  const sry = useSpring(ry, { stiffness: 180, damping: 18 });
  const glare = useMotionTemplate`radial-gradient(420px circle at ${gx}% ${gy}%, rgba(16,185,129,0.14), transparent 60%)`;

  if (!enabled) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={`relative ${className}`}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry.set((px - 0.5) * 10);
        rx.set(-(py - 0.5) * 10);
        gx.set(px * 100);
        gy.set(py * 100);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: glare }} />
      {children}
    </motion.div>
  );
}
