import { AnimatePresence, motion, useAnimationControls, useReducedMotion, type Variants } from "motion/react";
import { useEffect, type ReactNode } from "react";

/**
 * Transition propre à chaque étape. `custom` = sens de navigation
 * (1 : on avance, -1 : on revient) pour que les mouvements s'inversent.
 */
export type StepEffect = "blurRise" | "slide" | "flip" | "zoom" | "cascade" | "wipe" | "stack";

const EASE = [0.22, 1, 0.36, 1] as const;

const EFFECTS: Record<StepEffect, Variants> = {
  // Nom : la question émerge d'un flou.
  blurRise: {
    enter: (d: number) => ({ opacity: 0, y: 46 * d, filter: "blur(14px)" }),
    center: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
    exit: (d: number) => ({ opacity: 0, y: -30 * d, filter: "blur(10px)", transition: { duration: 0.28 } }),
  },
  // E-mail : glissement latéral, comme une carte qu'on fait défiler.
  slide: {
    enter: (d: number) => ({ opacity: 0, x: 140 * d }),
    center: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 260, damping: 28 } },
    exit: (d: number) => ({ opacity: 0, x: -140 * d, transition: { duration: 0.28, ease: "easeIn" } }),
  },
  // Organisation : la carte pivote en 3D.
  flip: {
    enter: (d: number) => ({ opacity: 0, rotateY: -70 * d, x: 40 * d }),
    center: { opacity: 1, rotateY: 0, x: 0, transition: { duration: 0.7, ease: EASE } },
    exit: (d: number) => ({ opacity: 0, rotateY: 70 * d, x: -40 * d, transition: { duration: 0.3, ease: "easeIn" } }),
  },
  // Fonction : effet de zoom, la question vient vers soi.
  zoom: {
    enter: { opacity: 0, scale: 0.72 },
    center: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } },
    exit: { opacity: 0, scale: 1.18, filter: "blur(6px)", transition: { duration: 0.28 } },
  },
  // Pays : le titre, puis les cartes en cascade (gérées par les enfants).
  cascade: {
    enter: { opacity: 0 },
    center: { opacity: 1, transition: { duration: 0.3, when: "beforeChildren", staggerChildren: 0.09 } },
    exit: { opacity: 0, y: -16, transition: { duration: 0.25 } },
  },
  // Téléphone : la question se dévoile derrière un masque.
  wipe: {
    enter: (d: number) => ({ clipPath: d > 0 ? "inset(0% 100% 0% 0%)" : "inset(0% 0% 0% 100%)" }),
    center: { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.75, ease: EASE } },
    exit: (d: number) => ({
      clipPath: d > 0 ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)",
      transition: { duration: 0.35, ease: "easeIn" },
    }),
  },
  // Récapitulatif : les réponses s'empilent l'une après l'autre.
  stack: {
    enter: { opacity: 0, y: 30 },
    center: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE, when: "beforeChildren", staggerChildren: 0.07 } },
    exit: { opacity: 0, y: 20, transition: { duration: 0.25 } },
  },
};

/** Élément qui suit la cascade de l'étape parente (pays, lignes du récapitulatif). */
export const cascadeItem: Variants = {
  enter: { opacity: 0, y: 18, scale: 0.94 },
  center: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 320, damping: 22 } },
  exit: { opacity: 0 },
};

export function StepStage({
  stepKey,
  effect,
  direction,
  shake,
  onEntered,
  children,
}: {
  stepKey: string;
  effect: StepEffect;
  direction: number;
  /** Change à chaque tentative refusée : la question tremble. */
  shake: number;
  onEntered?: () => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  useEffect(() => {
    if (shake && !reduce) void controls.start({ x: [0, -12, 10, -7, 4, 0], transition: { duration: 0.45 } });
  }, [shake]);

  return (
    // Le tremblement est porté par l'enveloppe, pour ne pas rompre la
    // propagation des variantes vers les éléments en cascade.
    <motion.div className="relative" style={{ perspective: 1100 }} animate={controls}>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={stepKey}
          custom={direction}
          variants={reduce ? undefined : EFFECTS[effect]}
          initial={reduce ? false : "enter"}
          animate="center"
          exit={reduce ? undefined : "exit"}
          onAnimationComplete={(def) => {
            if (def === "center") onEntered?.();
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

/** En-tête de progression : « Étape 2 sur 7 », barre animée, pastilles cliquables. */
export function StepProgress({
  current,
  total,
  reached,
  labels,
  onJump,
}: {
  current: number;
  total: number;
  reached: number;
  labels: string[];
  onJump: (i: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow text-forest">
          Étape {current + 1} sur {total}
        </p>
        <ol className="flex items-center gap-1.5" aria-label="Étapes">
          {labels.map((label, i) => {
            const done = i < current;
            const active = i === current;
            const reachable = i <= reached && !active;
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => onJump(i)}
                  aria-label={`${label}${active ? " (étape en cours)" : reachable ? " : revenir à cette étape" : ""}`}
                  aria-current={active ? "step" : undefined}
                  className="flex h-6 items-center disabled:cursor-default"
                >
                  <motion.span
                    className="block h-2 rounded-full"
                    initial={false}
                    animate={{
                      width: active ? 22 : 8,
                      backgroundColor: active ? "#073B32" : done || i <= reached ? "#10B981" : "#DDE5DF",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <motion.div
          className="h-full rounded-full bg-emeraude"
          initial={false}
          animate={{ width: `${((current + 1) / total) * 100}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 24 }}
        />
      </div>
    </div>
  );
}
