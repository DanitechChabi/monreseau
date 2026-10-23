import { motion, useReducedMotion } from "motion/react";
import { FieldError } from "./FieldTile";

const COUNTRIES = [
  { value: "BJ", label: "Bénin", hint: "+229" },
  { value: "NE", label: "Niger", hint: "+227" },
  { value: "other", label: "Autre", hint: "Autre pays" },
] as const;

/**
 * Pays : groupe de boutons radio natifs (clavier : flèches), habillés en
 * cartes. Une pastille glisse vers le choix ; chaque carte apparaît à son tour.
 */
export function CountryPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <fieldset aria-describedby={error ? "country-error" : undefined}>
      <legend className="text-small font-semibold text-ink">
        Pays<span aria-hidden="true" className="text-danger"> *</span>
      </legend>
      <div className={`mt-2 grid grid-cols-3 gap-2 rounded-2xl border bg-white p-1.5 ${error ? "border-danger" : "border-line"}`}>
        {COUNTRIES.map((c, i) => {
          const selected = value === c.value;
          return (
            <motion.label
              key={c.value}
              className="relative flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl px-2 text-center transition-transform active:scale-[0.96] motion-reduce:transition-none has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest"
              initial={reduce ? false : { opacity: 0, y: 14, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 320, damping: 20, delay: 0.35 + i * 0.08 }}
            >
              <input
                type="radio"
                name="country"
                id={i === 0 ? "country" : undefined}
                value={c.value}
                checked={selected}
                onChange={() => onChange(c.value)}
                className="sr-only"
              />
              {selected && (
                <motion.span
                  layoutId="country-pill"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-xl bg-forest shadow-[0_10px_24px_-12px_rgba(7,59,50,0.7)]"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className={`relative text-body font-semibold transition-colors ${selected ? "text-paper" : "text-ink"}`}>{c.label}</span>
              <span className={`relative text-[0.75rem] transition-colors ${selected ? "text-emeraude" : "text-ink-muted"}`}>{c.hint}</span>
            </motion.label>
          );
        })}
      </div>
      <FieldError id="country-error" message={error} />
    </fieldset>
  );
}

/** Case à cocher dont la coche se trace, avec un léger rebond. */
export function ConsentCheck({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const reduce = useReducedMotion();
  return (
    <label className="group flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-4 text-small text-ink transition-colors has-[:checked]:border-forest has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-forest">
      <input
        type="checkbox"
        name="marketing_consent"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <motion.span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2"
        animate={{
          backgroundColor: checked ? "#073B32" : "#FFFFFF",
          borderColor: checked ? "#073B32" : "#9AA9A2",
          scale: checked && !reduce ? [1, 1.25, 0.95, 1] : 1,
        }}
        transition={{ duration: 0.4 }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <motion.path
            d="M5 12.5l4.2 4.2L19 7"
            fill="none"
            stroke="#10B981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={{ duration: reduce ? 0 : 0.3, delay: checked ? 0.08 : 0 }}
          />
        </svg>
      </motion.span>
      <span>
        {label} <span className="text-ink-muted">(facultatif)</span>
      </span>
    </label>
  );
}
