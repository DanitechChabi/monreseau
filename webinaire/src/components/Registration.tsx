import { useRef, useState, type FormEvent } from "react";
import { organizerNames } from "../config/event";
import { useEvent } from "../hooks/useEvent";
import { backendConfigured, callFunction } from "../lib/backend";
import {
  type FieldErrors,
  type RegistrationField,
  validateRegistration,
} from "../../supabase/functions/_shared/validation.ts";
import { ResendConfirmation } from "./ResendConfirmation";
import { SectionHeading } from "./SectionHeading";

/**
 * Formulaire d'inscription, branché sur la fonction `register`.
 * Tant que VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ne sont pas renseignées,
 * il reste fermé et n'envoie rien.
 */

type Values = Record<RegistrationField, string> & { marketing_consent: boolean; website: string };
type Field = RegistrationField;

const EMPTY: Values = {
  full_name: "",
  email: "",
  organisation: "",
  job_title: "",
  country: "",
  phone: "",
  marketing_consent: false,
  website: "",
};
const ORDER: Field[] = ["full_name", "email", "organisation", "job_title", "country", "phone"];

type Outcome =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; email: string }
  | { kind: "pending"; email: string }
  | { kind: "already"; email: string; confirmed: boolean }
  | { kind: "rate_limited" }
  | { kind: "temporary_error" }
  | { kind: "closed" };

const inputCls =
  "mt-2 block min-h-12 w-full rounded-xl border bg-white px-4 text-body text-ink transition-colors focus:border-forest";

function clientErrors(v: Values): FieldErrors {
  const r = validateRegistration(v);
  return r.ok ? {} : r.errors;
}

export function Registration() {
  const event = useEvent();
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [resendEmail, setResendEmail] = useState<{ email: string; nonce: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const errors: FieldErrors = { ...clientErrors(values), ...serverErrors };
  const visibleError = (f: Field) => (touched[f] || submitted ? errors[f] : undefined);
  const busy = outcome.kind === "submitting";

  const update = (f: keyof Values, value: string | boolean) => {
    setValues((v) => ({ ...v, [f]: value }));
    setServerErrors((e) => {
      if (!(f in e)) return e;
      const next = { ...e };
      delete next[f as Field];
      return next;
    });
    if (outcome.kind !== "submitting") setOutcome({ kind: "idle" });
  };

  const showOutcome = (o: Outcome) => {
    setOutcome(o);
    // Le message remplace le formulaire : on y amène le focus (lecteurs d'écran, clavier).
    requestAnimationFrame(() => statusRef.current?.focus());
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    const first = ORDER.find((f) => errors[f]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    if (!backendConfigured) {
      setOutcome({ kind: "closed" });
      return;
    }

    setOutcome({ kind: "submitting" });
    const { httpStatus, data } = await callFunction<{ status?: string; confirmed?: boolean; errors?: FieldErrors }>("register", values);
    const email = values.email.trim().toLowerCase();
    const status = data?.status;

    if (httpStatus === 201 && status === "registered_email_sent") showOutcome({ kind: "sent", email });
    else if (httpStatus === 201 && status === "registered_email_pending") showOutcome({ kind: "pending", email });
    else if (httpStatus === 200 && status === "already_registered")
      showOutcome({ kind: "already", email, confirmed: data?.confirmed === true });
    else if (httpStatus === 422 && data?.errors) {
      setServerErrors(data.errors);
      setOutcome({ kind: "idle" });
      const firstServer = ORDER.find((f) => data.errors?.[f]);
      if (firstServer) formRef.current?.querySelector<HTMLElement>(`[name="${firstServer}"]`)?.focus();
    } else if (httpStatus === 429) setOutcome({ kind: "rate_limited" });
    else setOutcome({ kind: "temporary_error" });
  };

  const reset = () => {
    setValues(EMPTY);
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
    setOutcome({ kind: "idle" });
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[name="full_name"]')?.focus());
  };

  const errorCount = submitted ? Object.keys(errors).length : 0;

  const field = (
    f: Field,
    label: string,
    opts: { type?: string; autoComplete?: string; optional?: boolean; inputMode?: "tel" | "email" } = {},
  ) => {
    const err = visibleError(f);
    return (
      <div>
        <label htmlFor={f} className="text-small font-semibold text-ink">
          {label}
          {opts.optional ? (
            <span className="font-normal text-ink-muted"> (facultatif)</span>
          ) : (
            <span aria-hidden="true" className="text-danger"> *</span>
          )}
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
  const finished = outcome.kind === "sent" || outcome.kind === "pending" || outcome.kind === "already";

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

        <div className="on-light rounded-2xl bg-paper p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] sm:p-8">
          {finished ? (
            <div ref={statusRef} tabIndex={-1} role="status" className="focus:outline-none">
              <OutcomePanel
                outcome={outcome}
                onResend={(email) => setResendEmail({ email, nonce: Date.now() })}
                onReset={reset}
              />
            </div>
          ) : (
            <form ref={formRef} noValidate onSubmit={onSubmit} aria-describedby="form-legend" aria-busy={busy}>
              <p id="form-legend" className="text-small text-ink-muted">
                Les champs marqués d'un <span className="text-danger">*</span> sont obligatoires.
              </p>

              {errorCount > 0 && (
                <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-white p-4 text-small font-medium text-danger">
                  {errorCount === 1 ? "Un champ est à corriger." : `${errorCount} champs sont à corriger.`}
                </p>
              )}

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">{field("full_name", "Nom et prénom", { autoComplete: "name" })}</div>
                <div className="sm:col-span-2">
                  {field("email", "E-mail", { type: "email", autoComplete: "email", inputMode: "email" })}
                </div>
                {field("organisation", "Organisation", { autoComplete: "organization" })}
                {field("job_title", "Fonction", { autoComplete: "organization-title" })}
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

              {/* Pot de miel anti-robots : invisible et ignoré par les humains. */}
              <div aria-hidden="true" className="sr-only">
                <label htmlFor="website">Ne pas remplir ce champ</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  className="h-px w-px"
                  value={values.website}
                  onChange={(e) => update("website", e.target.value)}
                />
              </div>

              <label className="mt-6 flex cursor-pointer items-start gap-3 text-small text-ink">
                <input
                  type="checkbox"
                  name="marketing_consent"
                  checked={values.marketing_consent}
                  onChange={(e) => update("marketing_consent", e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-forest"
                />
                <span>
                  J'accepte de recevoir d'autres communications d'{organizerNames(event)}.{" "}
                  <span className="text-ink-muted">(facultatif)</span>
                </span>
              </label>

              <button
                type="submit"
                disabled={busy}
                aria-disabled={!backendConfigured || busy}
                aria-describedby={backendConfigured ? undefined : "registration-status"}
                className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-forest px-6 text-center text-body font-semibold text-paper transition-colors hover:bg-forest-deep disabled:cursor-wait aria-disabled:cursor-not-allowed aria-disabled:bg-forest/80"
              >
                {busy && (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-paper/40 border-t-paper motion-reduce:animate-none"
                  />
                )}
                {!backendConfigured
                  ? "Les inscriptions ouvriront très bientôt"
                  : busy
                    ? "Envoi en cours…"
                    : "Réserver ma place"}
              </button>
              <div id="registration-status" role="status" className="mt-4 text-small empty:hidden">
                {outcome.kind === "closed" && (
                  <p className="text-ink-muted">
                    Votre saisie est complète, mais les inscriptions ne sont pas encore ouvertes : aucune donnée n'a été
                    envoyée. Revenez très bientôt.
                  </p>
                )}
                {outcome.kind === "rate_limited" && (
                  <p className="text-danger">
                    Trop de tentatives depuis votre connexion. Patientez quelques minutes, puis réessayez.
                  </p>
                )}
                {outcome.kind === "temporary_error" && (
                  <p className="text-danger">
                    Un problème temporaire empêche l'envoi de votre inscription. Réessayez dans quelques instants
                    {event.contactEmail ? (
                      <>
                        {" "}ou écrivez-nous à{" "}
                        <a className="font-semibold underline" href={`mailto:${event.contactEmail}`}>
                          {event.contactEmail}
                        </a>
                      </>
                    ) : null}
                    .
                  </p>
                )}
              </div>
            </form>
          )}

          <div className="mt-8 border-t border-line pt-6">
            <p className="text-small text-ink-muted">
              Vos données servent uniquement à gérer votre inscription et à vous transmettre les informations du
              webinaire.{" "}
              <a href="/confidentialite" className="font-semibold text-forest underline underline-offset-2">
                En savoir plus
              </a>
            </p>
            {backendConfigured && <ResendConfirmation prefill={resendEmail} />}
          </div>
        </div>
      </div>
    </section>
  );
}

function OutcomePanel({
  outcome,
  onResend,
  onReset,
}: {
  outcome: Outcome;
  onResend: (email: string) => void;
  onReset: () => void;
}) {
  const title = (t: string) => <h3 className="text-h3 text-forest">{t}</h3>;
  const again = (
    <button type="button" onClick={onReset} className="mt-6 text-small font-semibold text-forest underline underline-offset-2">
      Inscrire une autre personne
    </button>
  );

  if (outcome.kind === "sent")
    return (
      <>
        {title("Inscription enregistrée")}
        <p className="mt-3 text-body text-ink">
          Un e-mail de confirmation vient d'être envoyé à <strong className="break-all">{outcome.email}</strong>.
        </p>
        <p className="mt-3 text-body text-ink-muted">
          Cliquez sur le lien qu'il contient pour confirmer votre adresse. Pensez à vérifier vos courriers indésirables.
        </p>
        {again}
      </>
    );
  if (outcome.kind === "pending")
    return (
      <>
        {title("Inscription enregistrée")}
        <p className="mt-3 text-body text-ink">
          Votre inscription est bien enregistrée, mais l'e-mail de confirmation n'a pas pu être envoyé pour le moment.
        </p>
        <p className="mt-3 text-body text-ink-muted">
          Vous pouvez le redemander dans quelques minutes avec le lien « Renvoyer la confirmation » ci-dessous.
        </p>
        <button
          type="button"
          onClick={() => onResend(outcome.email)}
          className="mt-6 inline-flex min-h-11 items-center rounded-full border border-forest px-5 text-small font-semibold text-forest transition-colors hover:bg-forest hover:text-paper"
        >
          Renvoyer l'e-mail de confirmation
        </button>
      </>
    );
  if (outcome.kind === "already")
    return (
      <>
        {title("Vous êtes déjà inscrit(e)")}
        {outcome.confirmed ? (
          <p className="mt-3 text-body text-ink">
            L'adresse <strong className="break-all">{outcome.email}</strong> est déjà inscrite et confirmée. Le lien de
            connexion vous sera envoyé par e-mail avant le webinaire.
          </p>
        ) : (
          <>
            <p className="mt-3 text-body text-ink">
              L'adresse <strong className="break-all">{outcome.email}</strong> est déjà inscrite à ce webinaire, mais n'a
              pas encore été confirmée.
            </p>
            <button
              type="button"
              onClick={() => onResend(outcome.email)}
              className="mt-6 inline-flex min-h-11 items-center rounded-full border border-forest px-5 text-small font-semibold text-forest transition-colors hover:bg-forest hover:text-paper"
            >
              Renvoyer l'e-mail de confirmation
            </button>
          </>
        )}
        {again}
      </>
    );
  return null;
}
