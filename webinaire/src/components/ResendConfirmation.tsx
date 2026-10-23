import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { callFunction } from "../lib/backend";
import { emailError, normalizeEmail } from "../../supabase/functions/_shared/validation.ts";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

/**
 * « Vous n'avez pas reçu l'e-mail ? » — petit formulaire de renvoi.
 * La réponse du serveur est neutre : elle ne dit jamais si l'adresse est inscrite.
 */
export function ResendConfirmation({
  prefill = null,
  defaultOpen = false,
}: {
  prefill?: { email: string; nonce: number } | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  // Ouverture depuis le panneau « déjà inscrit » / « e-mail en attente ».
  useEffect(() => {
    if (!prefill) return;
    setOpen(true);
    setEmail(prefill.email);
    setState({ kind: "idle" });
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [prefill]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state.kind === "sending") return;
    const value = normalizeEmail(email);
    const err = emailError(value);
    setFieldError(err ?? null);
    if (err) {
      inputRef.current?.focus();
      return;
    }
    setState({ kind: "sending" });
    const { httpStatus, data } = await callFunction<{ status?: string; message?: string; retry_after_minutes?: number }>(
      "resend-confirmation",
      { email: value },
    );
    if (httpStatus === 200 && data?.message) setState({ kind: "done", message: data.message });
    else if (httpStatus === 429 && data?.status === "cooldown")
      setState({
        kind: "error",
        message: `Une demande vient déjà d'être faite pour cette adresse. Patientez ${data.retry_after_minutes ?? 5} minutes avant de réessayer.`,
      });
    else if (httpStatus === 429)
      setState({ kind: "error", message: "Trop de demandes pour le moment. Réessayez un peu plus tard." });
    else if (httpStatus === 422) {
      setFieldError("Cette adresse e-mail ne semble pas valide (exemple : nom@organisation.org).");
      setState({ kind: "idle" });
    } else setState({ kind: "error", message: "Un problème temporaire empêche l'envoi. Réessayez dans quelques instants." });
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((v) => !v)}
        className="text-small text-ink-muted underline underline-offset-2 transition-colors hover:text-forest"
      >
        Vous n'avez pas reçu l'e-mail ? Renvoyer la confirmation
      </button>
      {open && (
        <form id={`${id}-panel`} noValidate onSubmit={submit} className="mt-4">
          <label htmlFor={`${id}-email`} className="text-small font-semibold text-ink">
            Adresse e-mail utilisée lors de l'inscription
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              ref={inputRef}
              id={`${id}-email`}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? `${id}-error` : undefined}
              className={`block min-h-11 w-full min-w-0 rounded-xl border bg-white px-4 text-body text-ink focus:border-forest ${fieldError ? "border-danger" : "border-line"}`}
            />
            <button
              type="submit"
              disabled={state.kind === "sending"}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-forest px-5 text-small font-semibold text-forest transition-colors hover:bg-forest hover:text-paper disabled:cursor-wait"
            >
              {state.kind === "sending" ? "Envoi…" : "Renvoyer"}
            </button>
          </div>
          {fieldError && (
            <p id={`${id}-error`} className="mt-2 text-small text-danger">
              {fieldError}
            </p>
          )}
          <p role="status" className="mt-3 text-small empty:hidden">
            {state.kind === "done" && <span className="text-forest">{state.message}</span>}
            {state.kind === "error" && <span className="text-danger">{state.message}</span>}
          </p>
        </form>
      )}
    </div>
  );
}
