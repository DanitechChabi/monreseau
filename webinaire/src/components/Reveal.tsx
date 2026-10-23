import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useLightMotion } from "../hooks/useMediaQuery";

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li";
};

/** Apparition discrète à l'entrée dans le viewport. Désactivée si l'utilisateur réduit les animations. */
export function Reveal({ children, className, delay = 0, as = "div" }: Props) {
  const reduce = useReducedMotion();
  const light = useLightMotion();
  const Tag = as === "li" ? motion.li : motion.div;

  if (reduce) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: light ? 10 : 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: light ? 0.45 : 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Tag>
  );
}
