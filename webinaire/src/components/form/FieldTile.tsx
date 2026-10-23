import { AnimatePresence, motion, useAnimationControls, useReducedMotion, type TargetAndTransition } from "motion/react";
import { useEffect, useState, type HTMLAttributes, type ReactNode } from "react";

/** Entrée propre à chaque champ (un effet différent par tuile). */
export type Entrance = "blurRise" | "fromLeft" | "flipUp" | "fromRight" | "zoom" | "wipe" | "fade" | "spring";

const ENTRANCES: Record<Entrance, { initial: TargetAndTransition; animate: TargetAndTransition }> = {
  blurRise: { initial: { opacity: 0, y: 26, filter: "blur(10px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" } },
  fromLeft: { initial: { opacity: 0, x: -48 }, animate: { opacity: 1, x: 0 } },
  flipUp: { initial: { opacity: 0, rotateX: -75, y: 20 }, animate: { opacity: 1, rotateX: 0, y: 0 } },
  fromRight: { initial: { opacity: 0, x: 48 }, animate: { opacity: 1, x: 0 } },
  zoom: { initial: { opacity: 0, scale: 0.88 }, animate: { opacity: 1, scale: 1 } },
  wipe: { initial: { clipPath: "inset(0% 100% 0% 0% round 16px)" }, animate: { clipPath: "inset(0% 0% 0% 0% round 16px)" } },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  spring: { initial: { opacity: 0, y: 40, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 } },
};

/** Conteneur animé : entrée à l'apparition, tremblement à chaque envoi en erreur. */
export function Animated({
  entrance,
  order,
  shake,
  hasError,
  className,
  children,
}: {
  entrance: Entrance;
  order: number;
  /** Change à chaque tentative d'envoi : déclenche le tremblement si le champ est en erreur. */
  shake: number;
  hasError: boolean;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  useEffect(() => {
    if (!shake || !hasError || reduce) return;
    void controls.start({ x: [0, -10, 9, -6, 4, 0], transition: { duration: 0.45 } });
  }, [shake]);

  const e = ENTRANCES[entrance];
  const transition =
    entrance === "spring"
      ? { type: "spring" as const, stiffness: 260, damping: 18, delay: order * 0.07 }
      : { duration: 0.75, ease: [0.22, 1, 0.36, 1] as const, delay: order * 0.07 };
  // L'enveloppe extérieure (jamais masquée) détecte l'entrée à l'écran ;
  // l'effet est porté par la couche intérieure (un élément entièrement masqué
  // par clip-path n'est pas considéré comme visible).
  return (
    <motion.div
      className={className}
      initial={reduce ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, amount: 0.3 }}
    >
      <motion.div
        style={{ transformPerspective: 800 }}
        variants={{ hidden: e.initial, shown: { ...e.animate, transition } }}
      >
        <motion.div animate={controls}>{children}</motion.div>
      </motion.div>
    </motion.div>
  );
}

/** Coche tracée quand le champ est valide. */
export function ValidMark({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.svg
          key="ok"
          viewBox="0 0 24 24"
          className="h-6 w-6 shrink-0 text-emeraude"
          aria-hidden="true"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 20 }}
        >
          <circle cx="12" cy="12" r="11" fill="currentColor" />
          <motion.path
            d="M7 12.5l3.2 3.2L17 9"
            fill="none"
            stroke="#073B32"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.35, delay: 0.1 }}
          />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          key={message}
          id={id}
          className="overflow-hidden text-small text-danger"
          initial={{ opacity: 0, height: 0, y: -6 }}
          animate={{ opacity: 1, height: "auto", y: 0, marginTop: 8 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.25 }}
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

type InputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  onFocus?: () => void;
  error?: string;
  valid: boolean;
  optional?: boolean;
  type?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  /** Pictogramme animé, piloté par l'état du champ. */
  icon: (s: { focused: boolean; value: string; valid: boolean }) => ReactNode;
};

/**
 * Tuile de saisie : libellé flottant, trait qui se dessine depuis le centre,
 * halo au focus, pictogramme vivant et coche de validation.
 */
export function FloatingInput(p: InputProps) {
  const reduce = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const floated = focused || p.value.length > 0;
  const t = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 380, damping: 30 };

  return (
    <div>
      <motion.div
        className={`relative flex min-h-[4.25rem] items-center gap-3 overflow-hidden rounded-2xl border bg-white pr-4 pl-3 transition-colors ${
          p.error ? "border-danger" : focused ? "border-forest" : "border-line"
        }`}
        animate={{
          boxShadow: focused
            ? "0 0 0 4px rgba(16,185,129,0.18), 0 14px 30px -18px rgba(7,59,50,0.45)"
            : "0 0 0 0px rgba(16,185,129,0), 0 1px 0 rgba(7,59,50,0.04)",
        }}
        transition={{ duration: 0.25 }}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emeraude-soft text-forest">
          {p.icon({ focused, value: p.value, valid: p.valid })}
        </span>
        <div className="relative min-w-0 flex-1 self-stretch">
          <motion.label
            htmlFor={p.id}
            className="pointer-events-none absolute top-1/2 left-0 origin-left text-body font-medium whitespace-nowrap text-ink-muted"
            initial={false}
            animate={floated ? { y: "-128%", scale: 0.78, color: p.error ? "#B42318" : "#073B32" } : { y: "-50%", scale: 1, color: "#4B5563" }}
            transition={t}
          >
            {p.label}
            {p.optional ? (
              <span className="font-normal"> (facultatif)</span>
            ) : (
              <span aria-hidden="true" className="text-danger">
                {" "}*
              </span>
            )}
          </motion.label>
          <input
            id={p.id}
            name={p.id}
            type={p.type ?? "text"}
            inputMode={p.inputMode}
            autoComplete={p.autoComplete}
            value={p.value}
            required={!p.optional}
            placeholder={floated ? p.placeholder : undefined}
            aria-invalid={p.error ? true : undefined}
            aria-describedby={p.error ? `${p.id}-error` : undefined}
            onChange={(e) => p.onChange(e.target.value)}
            onFocus={() => {
              setFocused(true);
              p.onFocus?.();
            }}
            onBlur={() => {
              setFocused(false);
              p.onBlur();
            }}
            className="absolute inset-x-0 bottom-0 h-[62%] w-full bg-transparent text-body text-ink placeholder:text-ink-muted/50 focus:outline-none focus-visible:outline-none"
          />
        </div>
        <ValidMark show={p.valid && !focused} />
        <motion.span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[3px] origin-center bg-emeraude"
          initial={false}
          animate={{ scaleX: focused ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
      </motion.div>
      <FieldError id={`${p.id}-error`} message={p.error} />
    </div>
  );
}
