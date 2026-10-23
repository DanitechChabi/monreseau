import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { organizerNames } from "../config/event";
import { useEvent } from "../hooks/useEvent";
import { backendConfigured, callFunction } from "../lib/backend";
import {
  type FieldErrors,
  type RegistrationField,
  validateRegistration,
} from "../../supabase/functions/_shared/validation.ts";
import { ConsentCheck, CountryPicker } from "./form/Choices";
import { EmailIcon, JobIcon, NameIcon, OrgIcon, PhoneIcon } from "./form/FieldIcons";
import { FloatingInput } from "./form/FieldTile";
import { cascadeItem, type StepEffect, StepProgress, StepStage } from "./form/Stepper";
import { SubmitButton } from "./form/SubmitButton";
import { ResendConfirmation } from "./ResendConfirmation";
import { SectionHeading } from "./SectionHeading";

/**
 * Formulaire d'inscription pas à pas (une question par écran), branché sur la
 * fonction `register`. Chaque étape a sa propre transition ; la dernière
 * récapitule les réponses avant l'envoi.
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

type Step = { field: Field | null; effect: StepEffect; label: string; question: string; help: string };

const STEPS: Step[] = [
  {
    field: "full_name",
    effect: "blurRise",
    label: "Nom et prénom",
    question: "Comment vous appelez-vous ?",
    help: "Votre nom et votre prénom, tels qu'ils figureront sur votre inscription.",
  },
  {
    field: "email",
    effect: "slide",
    label: "E-mail",
    question: "À quelle adresse vous écrire ?",
    help: "Vous y recevrez la confirmation, puis le lien de connexion au webinaire.",
  },
  {
    field: "organisation",
    effect: "flip",
    label: "Organisation",
    question: "Pour quelle organisation travaillez-vous ?",
    help: "Administration, entreprise, association, établissement…",
  },
  {
    field: "job_title",
    effect: "zoom",
    label: "Fonction",
    question: "Quelle est votre fonction ?",
    help: "Par exemple : archiviste, secrétaire, responsable administratif…",
  },
  {
    field: "country",
    effect: "cascade",
    label: "Pays",
    question: "Dans quel pays êtes-vous ?",
    help: "Des exemples du Bénin et du Niger seront présentés.",
  },
  {
    field: "phone",
    effect: "wipe",
    label: "Téléphone",
    question: "Un numéro pour vous joindre ?",
    help: "Facultatif : uniquement en cas de besoin lié au webinaire.",
  },
  {
    field: null,
    effect: "stack",
    label: "Vérification",
    question: "Vérifiez vos informations",
    help: "Vous pouvez modifier chaque réponse avant d'envoyer.",
  },
];
const LAST = STEPS.length - 1;
const COUNTRY_LABEL: Record<string, string> = { BJ: "Bénin", NE: "Niger", other: "Autre" };
const PREFIX: Record<string, string> = { BJ: "+229 ", NE: "+227 " };

type Outcome =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent"; email: string }
  | { kind: "pending"; email: string }
  | { kind: "already"; email: string; confirmed: boolean }
  | { kind: "rate_limited" }
  | { kind: "temporary_error" }
  | { kind: "closed" };

function clientErrors(v: Values): FieldErrors {
  const r = validateRegistration(v);
  return r.ok ? {} : r.errors;
}

export function Registration() {
  const event = useEvent();
  const reduce = useReducedMotion();
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [direction, setDirection] = useState(1);
  const [shake, setShake] = useState(0);
  const [navigated, setNavigated] = useState(false);
  const [resendEmail, setResendEmail] = useState<{ email: string; nonce: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const errors: FieldErrors = { ...clientErrors(values), ...serverErrors };
  const visibleError = (f: Field) => (touched[f] ? errors[f] : undefined);
  const busy = outcome.kind === "submitting";
  const current = STEPS[step]!;

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

  // Après chaque changement d'étape, le focus va au champ de la nouvelle question
  // (jamais au chargement de la page, pour ne pas faire défiler jusqu'au formulaire).
  useEffect(() => {
    if (!navigated) return;
    const id = window.setTimeout(
      () => {
        const root = formRef.current;
        // Champ de la question ; à défaut (récapitulatif), le titre de l'étape.
        const target =
          root?.querySelector<HTMLElement>("[data-step-focus] input:checked") ??
          root?.querySelector<HTMLElement>("[data-step-focus] input") ??
          root?.querySelector<HTMLElement>("[data-step-focus] h3");
        target?.focus({ preventScroll: true });
      },
      reduce ? 0 : 650,
    );
    return () => window.clearTimeout(id);
  }, [step, navigated, reduce]);

  const goTo = (i: number) => {
    setDirection(i > step ? 1 : -1);
    setStep(i);
    setReached((r) => Math.max(r, i));
    setNavigated(true);
  };

  /** Valide la question courante ; en cas d'erreur, la question tremble. */
  const next = () => {
    const f = current.field;
    // Indicatif seul (pré-rempli) = numéro non renseigné : on passe l'étape.
    if (f === "phone" && Object.values(PREFIX).includes(values.phone)) {
      update("phone", "");
      goTo(step + 1);
      return;
    }
    if (f) {
      setTouched((t) => ({ ...t, [f]: true }));
      if (errors[f]) {
        setShake((n) => n + 1);
        return;
      }
    }
    goTo(Math.min(step + 1, LAST));
  };

  const showOutcome = (o: Outcome) => {
    setOutcome(o);
    // Le message remplace le formulaire : on y amène le focus (lecteurs d'écran, clavier).
    requestAnimationFrame(() => statusRef.current?.focus());
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    // « Entrée » dans un champ = passer à la question suivante.
    if (step < LAST) {
      next();
      return;
    }
    const first = ORDER.find((f) => errors[f]);
    if (first) {
      setTouched((t) => ({ ...t, [first]: true }));
      goTo(ORDER.indexOf(first));
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
      if (firstServer) {
        setTouched((t) => ({ ...t, [firstServer]: true }));
        goTo(ORDER.indexOf(firstServer));
      }
    } else if (httpStatus === 429) setOutcome({ kind: "rate_limited" });
    else setOutcome({ kind: "temporary_error" });
  };

  const reset = () => {
    setValues(EMPTY);
    setTouched({});
    setServerErrors({});
    setOutcome({ kind: "idle" });
    setReached(0);
    goTo(0);
  };

  const isValid = (f: Field) => values[f].trim().length > 0 && !errors[f];

  const input = (
    f: Field,
    label: string,
    icon: Parameters<typeof FloatingInput>[0]["icon"],
    opts: {
      type?: string;
      autoComplete?: string;
      optional?: boolean;
      inputMode?: "tel" | "email";
      placeholder?: string;
      onFocus?: () => void;
      onBlur?: () => void;
    } = {},
  ) => (
    <FloatingInput
      id={f}
      label={label}
      value={values[f]}
      onChange={(v) => update(f, v)}
      onFocus={opts.onFocus}
      onBlur={() => {
        opts.onBlur?.();
        if (values[f]) setTouched((t) => ({ ...t, [f]: true }));
      }}
      error={visibleError(f)}
      valid={isValid(f)}
      optional={opts.optional}
      type={opts.type}
      autoComplete={opts.autoComplete}
      inputMode={opts.inputMode}
      placeholder={opts.placeholder}
      icon={icon}
    />
  );

  const fieldFor = (f: Field | null): ReactNode => {
    switch (f) {
      case "full_name":
        return input("full_name", "Nom et prénom", ({ value }) => <NameIcon value={value} />, { autoComplete: "name" });
      case "email":
        return input("email", "E-mail", (st) => <EmailIcon {...st} />, {
          type: "email",
          autoComplete: "email",
          inputMode: "email",
          placeholder: "nom@organisation.org",
        });
      case "organisation":
        return input("organisation", "Organisation", ({ value }) => <OrgIcon value={value} />, { autoComplete: "organization" });
      case "job_title":
        return input("job_title", "Fonction", ({ focused }) => <JobIcon focused={focused} />, { autoComplete: "organization-title" });
      case "country":
        return (
          <CountryPicker
            value={values.country}
            error={visibleError("country")}
            onChange={(c) => {
              // L'indicatif téléphonique suit le pays tant que le numéro n'est pas commencé.
              const onlyPrefix = Object.values(PREFIX).includes(values.phone);
              update("country", c);
              if (onlyPrefix) update("phone", PREFIX[c] ?? "");
            }}
          />
        );
      case "phone":
        return input("phone", "Téléphone", ({ focused }) => <PhoneIcon focused={focused} />, {
          type: "tel",
          autoComplete: "tel",
          inputMode: "tel",
          optional: true,
          placeholder: "01 23 45 67 89",
          onFocus: () => {
            if (!values.phone && PREFIX[values.country]) update("phone", PREFIX[values.country]!);
          },
          onBlur: () => {
            if (Object.values(PREFIX).includes(values.phone)) update("phone", "");
          },
        });
      default:
        return null;
    }
  };

  const recap = (
    <div className="grid gap-2">
      {ORDER.map((f, i) => {
        const raw = f === "country" ? (COUNTRY_LABEL[values.country] ?? "") : values[f].trim();
        return (
          <motion.div
            key={f}
            variants={reduce ? undefined : cascadeItem}
            className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-[0.75rem] font-semibold tracking-wide text-ink-muted uppercase">{STEPS[i]!.label}</p>
              <p className={`truncate text-body ${raw ? "text-ink" : "text-ink-muted italic"}`}>{raw || "Non renseigné"}</p>
            </div>
            <button
              type="button"
              onClick={() => goTo(i)}
              className="shrink-0 text-small font-semibold text-forest underline underline-offset-2"
              aria-label={`Modifier : ${STEPS[i]!.label}`}
            >
              Modifier
            </button>
          </motion.div>
        );
      })}
      <motion.div variants={reduce ? undefined : cascadeItem} className="mt-2">
        <ConsentCheck
          checked={values.marketing_consent}
          onChange={(v) => update("marketing_consent", v)}
          label={`J'accepte de recevoir d'autres communications d'${organizerNames(event)}.`}
        />
      </motion.div>
      <motion.div variants={reduce ? undefined : cascadeItem} className="mt-4">
        <SubmitButton busy={busy} open={backendConfigured} />
      </motion.div>
    </div>
  );

  const finished = outcome.kind === "sent" || outcome.kind === "pending" || outcome.kind === "already";

  return (
    <section id="inscription" aria-labelledby="inscription-title" className="overflow-x-clip bg-forest py-20 md:py-28">
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
            <form ref={formRef} noValidate onSubmit={onSubmit} aria-busy={busy}>
              <StepProgress current={step} total={STEPS.length} reached={reached} labels={STEPS.map((s) => s.label)} onJump={goTo} />
              <p className="sr-only" aria-live="polite">
                Étape {step + 1} sur {STEPS.length} : {current.label}
              </p>

              <div className="mt-8 min-h-[19rem] sm:min-h-[17rem]">
                <StepStage stepKey={String(step)} effect={current.effect} direction={direction} shake={shake}>
                  <div data-step-focus>
                    <h3 tabIndex={-1} className="text-h3 text-forest focus:outline-none">
                      {current.question}
                    </h3>
                    <p className="mt-2 text-small text-ink-muted">{current.help}</p>
                    <div className="mt-6">{current.field ? fieldFor(current.field) : recap}</div>
                  </div>
                </StepStage>
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

              {step < LAST && (
                <div className="mt-6 flex items-center justify-between gap-3">
                  {step > 0 ? (
                    <button
                      type="button"
                      onClick={() => goTo(step - 1)}
                      className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-small font-semibold text-forest hover:bg-emeraude-soft"
                    >
                      <span aria-hidden="true">←</span> Retour
                    </button>
                  ) : (
                    <span />
                  )}
                  <motion.button
                    type="submit"
                    whileHover={reduce ? undefined : { scale: 1.03 }}
                    whileTap={reduce ? undefined : { scale: 0.96 }}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full bg-forest px-6 text-body font-semibold text-paper hover:bg-forest-deep"
                  >
                    {current.field === "phone" && (!values.phone.trim() || Object.values(PREFIX).includes(values.phone))
                      ? "Passer cette étape"
                      : "Continuer"}
                    <span aria-hidden="true">→</span>
                  </motion.button>
                </div>
              )}
              {step < LAST && <p className="mt-3 text-right text-[0.75rem] text-ink-muted">Astuce : appuyez sur Entrée pour continuer.</p>}

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
