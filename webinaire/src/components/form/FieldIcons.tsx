import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const svg = "h-6 w-6";
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Nom : silhouette, puis pastille aux initiales qui se mettent à jour à la frappe. */
export function NameIcon({ value }: { value: string }) {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {initials ? (
        <motion.span
          key={initials}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-forest font-display text-small font-semibold text-paper"
          initial={{ scale: 0.3, rotate: -40, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.3, rotate: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
        >
          {initials}
        </motion.span>
      ) : (
        <motion.svg key="person" viewBox="0 0 24 24" className={svg} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <circle cx="12" cy="8" r="3.6" {...stroke} />
          <path d="M5 20c1.2-3.6 3.8-5.4 7-5.4s5.8 1.8 7 5.4" {...stroke} />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}

/** E-mail : l'enveloppe s'ouvre pendant la saisie, se ferme (verte) une fois l'adresse valide. */
export function EmailIcon({ focused, valid, value }: { focused: boolean; valid: boolean; value: string }) {
  const open = focused && !valid;
  const hasAt = value.includes("@");
  return (
    <motion.svg viewBox="0 0 24 24" className={svg} animate={{ color: valid ? "#0E9F6E" : "#073B32" }}>
      <rect x="3" y="6" width="18" height="13" rx="2" {...stroke} />
      <motion.path
        d="M3.5 7l8.5 6.5L20.5 7"
        {...stroke}
        style={{ originX: 0.5, originY: 0 }}
        animate={{ scaleY: open ? -0.6 : 1, y: open ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      />
      <motion.circle cx="18.5" cy="6.5" r="2.6" fill="#10B981" initial={false} animate={{ scale: hasAt && !valid ? [1, 1.4, 1] : 0 }} transition={{ duration: 0.4 }} />
    </motion.svg>
  );
}

/** Organisation : les fenêtres de l'immeuble s'allument au fil des caractères. */
export function OrgIcon({ value }: { value: string }) {
  const lit = Math.min(6, Math.ceil(value.trim().length / 2));
  const windows = [
    [8.5, 7], [12.5, 7], [8.5, 10.5], [12.5, 10.5], [8.5, 14], [12.5, 14],
  ] as const;
  return (
    <svg viewBox="0 0 24 24" className={svg}>
      <path d="M6 21V4h11v17M3 21h18M10 21v-3h3v3" {...stroke} />
      {windows.map(([x, y], i) => (
        <motion.rect
          key={i}
          x={x - 1}
          y={y - 1}
          width="2.4"
          height="2"
          rx="0.4"
          initial={false}
          animate={{ fill: i < lit ? "#10B981" : "rgba(7,59,50,0.18)", scale: i < lit ? [1, 1.5, 1] : 1 }}
          transition={{ duration: 0.35 }}
        />
      ))}
    </svg>
  );
}

/** Fonction : la mallette s'entrouvre au focus. */
export function JobIcon({ focused }: { focused: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={svg}>
      <rect x="3" y="8" width="18" height="12" rx="2" {...stroke} />
      <path d="M3 13h18" {...stroke} />
      <motion.path
        d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8"
        {...stroke}
        animate={{ y: focused ? -2 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 14 }}
      />
      <motion.rect x="10.5" y="12" width="3" height="2.4" rx="0.5" fill="currentColor" animate={{ scaleY: focused ? 1.4 : 1 }} />
    </svg>
  );
}

/** Téléphone : le combiné « sonne » à chaque prise de focus. */
export function PhoneIcon({ focused }: { focused: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className={svg}
      animate={focused && !reduce ? { rotate: [0, -14, 12, -10, 8, 0] } : { rotate: 0 }}
      transition={{ duration: 0.6 }}
    >
      <path
        d="M6.6 3.5h2.6l1.3 4-1.9 1.3a11 11 0 0 0 6.6 6.6l1.3-1.9 4 1.3v2.6A2 2 0 0 1 18.4 19.5 15.5 15.5 0 0 1 4.5 5.6a2 2 0 0 1 2.1-2.1Z"
        {...stroke}
      />
      <motion.path d="M15 4.5a5 5 0 0 1 4.5 4.5" {...stroke} animate={{ opacity: focused ? 1 : 0 }} />
    </motion.svg>
  );
}
