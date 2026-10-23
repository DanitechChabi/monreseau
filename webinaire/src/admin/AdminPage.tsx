import type { Session } from "@supabase/supabase-js";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { backendConfigured, callFunction } from "../lib/backend";
import { emailError, normalizeEmail } from "../../supabase/functions/_shared/validation.ts";
import { supabase } from "./client";
import { AttendancePanel } from "./AttendancePanel";
import { Dashboard } from "./Dashboard";

type Gate = "loading" | "signed_out" | "checking" | "admin" | "forbidden";

/**
 * /admin — connexion par lien magique, réservée aux adresses de la table
 * `admins`. L'interface ne fait que refléter les contrôles serveur : RLS sur
 * les tables, vérification de l'adresse dans chaque fonction d'administration.
 */
export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [gate, setGate] = useState<Gate>("loading");

  useEffect(() => {
    document.title = "Administration · Webinaire";
    if (!backendConfigured) return;
    const sb = supabase();
    void sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setGate(data.session ? "checking" : "signed_out");
    });
    const { data } = sb.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setGate(s ? "checking" : "signed_out");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (gate !== "checking" || !session) return;
    void supabase()
      .rpc("is_admin")
      .then(({ data, error }) => setGate(!error && data === true ? "admin" : "forbidden"));
  }, [gate, session]);

  const signOut = () => void supabase().auth.signOut();

  return (
    <div className="on-light min-h-dvh bg-paper">
      <header className="bg-forest text-paper">
        <div className="container-page flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
          <p className="font-display text-body font-semibold">
            Administration <span className="text-emeraude">·</span> Inscriptions au webinaire
          </p>
          {session && (
            <div className="flex items-center gap-3 text-small">
              <span className="hidden text-mist sm:inline">{session.user.email}</span>
              <button
                type="button"
                onClick={signOut}
                className="rounded-full border border-mist/50 px-4 py-2 font-semibold text-paper hover:border-paper"
              >
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </header>

      <main id="contenu" className="container-page py-10">
        {!backendConfigured ? (
          <Notice title="Backend non configuré">
            Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (voir .env.example), puis relancez le site.
          </Notice>
        ) : gate === "loading" || gate === "checking" ? (
          <p role="status" className="text-body text-ink-muted">
            Chargement…
          </p>
        ) : gate === "signed_out" ? (
          <LoginForm />
        ) : gate === "forbidden" ? (
          <Notice title="Accès refusé">
            Cette adresse n'est pas autorisée à consulter les inscriptions.{" "}
            <button type="button" onClick={signOut} className="font-semibold text-forest underline">
              Se déconnecter
            </button>
          </Notice>
        ) : (
          session && <AdminTabs session={session} />
        )}
      </main>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-xl rounded-2xl border border-line bg-white p-6" role="status">
      <h1 className="text-h3 text-forest">{title}</h1>
      <p className="mt-3 text-body text-ink">{children}</p>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = normalizeEmail(email);
    const err = emailError(value);
    setError(err ?? null);
    if (err || sending) return;
    setSending(true);
    const { httpStatus, data } = await callFunction<{ message?: string }>("admin-login", { email: value });
    setSending(false);
    if (httpStatus === 200 && data?.message) setMessage(data.message);
    else if (httpStatus === 429) setError("Trop de demandes. Réessayez dans un moment.");
    else setError("Un problème temporaire empêche l'envoi du lien. Réessayez dans quelques instants.");
  };

  return (
    <form noValidate onSubmit={submit} className="max-w-md rounded-2xl border border-line bg-white p-6 sm:p-8">
      <h1 className="text-h3 text-forest">Connexion</h1>
      <p className="mt-2 text-small text-ink-muted">
        Indiquez votre adresse d'organisateur : vous recevrez un lien de connexion par e-mail.
      </p>
      <label htmlFor="admin-email" className="mt-6 block text-small font-semibold text-ink">
        Adresse e-mail
      </label>
      <input
        id="admin-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "admin-email-error" : undefined}
        className={`mt-2 block min-h-12 w-full rounded-xl border bg-white px-4 text-body text-ink focus:border-forest ${error ? "border-danger" : "border-line"}`}
      />
      {error && (
        <p id="admin-email-error" className="mt-2 text-small text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-forest px-6 font-semibold text-paper hover:bg-forest-deep disabled:cursor-wait"
      >
        {sending ? "Envoi…" : "Recevoir un lien de connexion"}
      </button>
      <p role="status" className="mt-4 text-small text-forest empty:hidden">
        {message}
      </p>
    </form>
  );
}

function AdminTabs({ session }: { session: Session }) {
  const [tab, setTab] = useState<"inscriptions" | "attestations">("inscriptions");
  const tabs = [
    ["inscriptions", "Inscriptions"],
    ["attestations", "Présences et attestations"],
  ] as const;
  return (
    <>
      <div role="tablist" aria-label="Sections de l'administration" className="mb-8 flex flex-wrap gap-2 border-b border-line">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-3 text-small font-semibold ${tab === id ? "border-forest text-forest" : "border-transparent text-ink-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "inscriptions" ? <Dashboard session={session} /> : <AttendancePanel session={session} />}
    </>
  );
}
