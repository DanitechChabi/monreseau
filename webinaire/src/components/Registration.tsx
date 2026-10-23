import { useRef, useState, type FormEvent } from "react";
import { SectionHeading } from "./SectionHeading";

/**
 * Passe 1 : interface uniquement. Aucune donnée n'est envoyée et aucune
 * inscription n'est simulée. L'envoi sera branché en passe 2
 * (voir `registrationEndpoint` dans src/config/event.ts).
 */
const REGISTRATION_OPEN = false;

type Values = {
  fullName: string;
  email: string;
  organisation: string;
  role: string;
  country: string;
  phone: string;
};
type Field = keyof Values;
type Errors = Partial<Record<Field, string>>;

const EMPTY: Values = { fullName: "", email: "", organisation: "", role: "", country: "", phone: "" };
const ORDER: Field[] = ["fullName", "email", "organisation", "role", "country", "phone"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[\d\s().-]+$/;

function validate(v: Values): Errors {
  const e: Errors = {};
  const name = v.fullName.trim();
  if (!name) e.fullName = "Veuillez indiquer votre nom et votre prénom.";
  else if (name.length < 3 || !name.includes(" ")) e.fullName = "Indiquez votre nom et votre prénom, séparés par un espace.";

  const email = v.email.trim();
  if (!email) e.email = "Veuillez indiquer votre adresse e-mail.";
  else if (!EMAIL_RE.test(email)) e.email = "Cette adresse e-mail ne semble pas valide (exemple : nom@organisation.org).";

  if (!v.organisation.trim()) e.organisation = "Veuillez indiquer votre organisation.";
  if (!v.role.trim()) e.role = "Veuillez indiquer votre fonction.";
  if (!v.country) e.country = "Veuillez choisir votre pays.";

  const phone = v.phone.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, "").length;
    if (!PHONE_RE.test(phone) || digits < 8 || digits > 15)
      e.phone = "Ce numéro ne semble pas valide. Utilisez uniquement des chiffres, éventuellement précédés de l'indicatif (+229, +227…).";
  }
  return e;
}

const inputCls =
  "mt-2 block min-h-12 w-full rounded-xl border bg-white px-4 text-body text-ink transition-colors focus:border-forest";

export function Registration() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const errors = validate(values);
  const visibleError = (f: Field) => (touched[f] || submitted ? errors[f] : undefined);

  const update = (f: Field, value: string) => {
    setValues((v) => ({ ...v, [f]: value }));
    setNotice(null);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const first = ORDER.find((f) => errors[f]);
    if (first) {
      setNotice(null);
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    if (!REGISTRATION_OPEN) {
      setNotice(
        "Votre saisie est complète, mais les inscriptions ne sont pas encore ouvertes : aucune donnée n'a été envoyée. Revenez très bientôt.",
      );
    }
  };

  const errorCount = submitted ? Object.keys(errors).length : 0;

  const field = (f: Field, label: string, opts: { type?: string; autoComplete?: string; optional?: boolean; inputMode?: "tel" | "email" } = {}) => {
    const err = visibleError(f);
    return (
      <div>
        <label htmlFor={f} className="text-small font-semibold text-ink">
          {label}
          {opts.optional ? <span className="font-normal text-ink-muted"> (facultatif)</span> : <span aria-hidden="true" className="text-danger"> *</span>}
        </label>
        <input
          id={f}
          name={f}
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          autoComplete={opts.autoComplete}
          value={values[f]}
          required={!opts.optional}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${f}-error` : undefined}
          onChange={(e) => update(f, e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, [f]: true }))}
          className={`${inputCls} ${err ? "border-danger" : "border-line"}`}
        />
        {err && (
          <p id={`${f}-error`} className="mt-2 text-small text-danger">
            {err}
          </p>
        )}
      </div>
    );
  };

  const countryErr = visibleError("country");

  return (
    <section id="inscription" aria-labelledby="inscription-title" className="bg-forest py-20 md:py-28">
      <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
        <SectionHeading
          id="inscription-title"
          tone="dark"
          eyebrow="Inscription gratuite"
          title="Réservez votre place"
          intro="L'inscription est obligatoire. Le lien de connexion vous sera envoyé par e-mail, à l'adresse indiquée."
        />

        <form
          ref={formRef}
          noValidate
          onSubmit={onSubmit}
          aria-describedby="form-legend"
          className="on-light rounded-2xl bg-paper p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] sm:p-8"
        >
          <p id="form-legend" className="text-small text-ink-muted">
            Les champs marqués d'un <span className="text-danger">*</span> sont obligatoires.
          </p>

          {errorCount > 0 && (
            <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-white p-4 text-small font-medium text-danger">
              {errorCount === 1 ? "Un champ est à corriger." : `${errorCount} champs sont à corriger.`}
            </p>
          )}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">{field("fullName", "Nom et prénom", { autoComplete: "name" })}</div>
            <div className="sm:col-span-2">{field("email", "E-mail", { type: "email", autoComplete: "email", inputMode: "email" })}</div>
            {field("organisation", "Organisation", { autoComplete: "organization" })}
            {field("role", "Fonction", { autoComplete: "organization-title" })}
            <div>
              <label htmlFor="country" className="text-small font-semibold text-ink">
                Pays<span aria-hidden="true" className="text-danger"> *</span>
              </label>
              <select
                id="country"
                name="country"
                required
                value={values.country}
                aria-invalid={countryErr ? true : undefined}
                aria-describedby={countryErr ? "country-error" : undefined}
                onChange={(e) => {
                  update("country", e.target.value);
                  setTouched((t) => ({ ...t, country: true }));
                }}
                onBlur={() => setTouched((t) => ({ ...t, country: true }))}
                className={`${inputCls} appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10 ${countryErr ? "border-danger" : "border-line"}`}
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23073B32' stroke-width='1.8'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
                }}
              >
                <option value="">Choisir…</option>
                <option value="BJ">Bénin</option>
                <option value="NE">Niger</option>
                <option value="other">Autre</option>
              </select>
              {countryErr && (
                <p id="country-error" className="mt-2 text-small text-danger">
                  {countryErr}
                </p>
              )}
            </div>
            {field("phone", "Téléphone", { type: "tel", autoComplete: "tel", inputMode: "tel", optional: true })}
          </div>

          <button
            type="submit"
            aria-disabled={!REGISTRATION_OPEN}
            aria-describedby={REGISTRATION_OPEN ? undefined : "registration-status"}
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-forest px-6 text-center text-body font-semibold text-paper transition-colors hover:bg-forest-deep aria-disabled:cursor-not-allowed aria-disabled:bg-forest/80"
          >
            {REGISTRATION_OPEN ? "Réserver ma place" : "Les inscriptions ouvriront très bientôt"}
          </button>
          <p id="registration-status" role="status" className="mt-4 text-small text-ink-muted empty:hidden">
            {notice}
          </p>
        </form>
      </div>
    </section>
  );
}
