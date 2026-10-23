import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/** Bouton d'envoi : pression élastique, barre lumineuse qui défile pendant l'envoi. */
export function SubmitButton({ busy, open }: { busy: boolean; open: boolean }) {
  const reduce = useReducedMotion();
  const label = !open ? "Les inscriptions ouvriront très bientôt" : busy ? "Envoi en cours…" : "Réserver ma place";
  return (
    <motion.button
      type="submit"
      disabled={busy}
      aria-disabled={!open || busy}
      aria-describedby={open ? undefined : "registration-status"}
      whileHover={reduce || !open ? undefined : { scale: 1.015 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="relative inline-flex min-h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-forest px-6 text-center text-body font-semibold text-paper transition-colors hover:bg-forest-deep disabled:cursor-wait aria-disabled:cursor-not-allowed aria-disabled:bg-forest/80"
    >
      {busy && !reduce && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 -left-1/3 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(16,185,129,0.55),transparent)]"
          animate={{ x: ["0%", "400%"] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={label}
          className="relative"
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
      {open && !busy && (
        <motion.svg viewBox="0 0 24 24" className="relative h-5 w-5" aria-hidden="true" initial={false} whileHover={{ x: 4 }}>
          <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      )}
    </motion.button>
  );
}
