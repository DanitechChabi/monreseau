import { useEffect, useState } from "react";
import { backendConfigured, supabaseAnonKey, supabaseUrl } from "../lib/backend";
import { PageShell } from "./PageShell";

type Result =
  | { kind: "loading" }
  | { kind: "valid" | "revoked"; code: string; holder: string; title: string; date: string | null; organizers: { name: string; country: string }[]; issued_at: string | null }
  | { kind: "not_found" }
  | { kind: "error" };

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)) : null;

/** /verification/:code — vérification publique d'une attestation (lecture côté serveur uniquement). */
export function VerificationPage({ code }: { code: string }) {
  const [r, setR] = useState<Result>({ kind: "loading" });

  useEffect(() => {
    // Page sans intérêt pour les moteurs de recherche.
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.append(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    if (!backendConfigured) return setR({ kind: "error" });
    fetch(`${supabaseUrl}/functions/v1/verify-certificate?code=${encodeURIComponent(code)}`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (res.status === 200 && (data?.status === "valid" || data?.status === "revoked")) setR({ kind: data.status, ...data });
        else if (res.status === 404) setR({ kind: "not_found" });
        else setR({ kind: "error" });
      })
      .catch(() => setR({ kind: "error" }));
  }, [code]);

  const title =
    r.kind === "valid" ? "Attestation valide" : r.kind === "revoked" ? "Attestation révoquée" : r.kind === "not_found" ? "Attestation introuvable" : "Vérification d'une attestation";

  return (
    <PageShell eyebrow="Vérification d'attestation" title={title} docTitle={title}>
      <div className="max-w-2xl" role="status" aria-live="polite">
        {r.kind === "loading" && <p className="text-body text-ink-muted">Vérification en cours…</p>}
        {r.kind === "error" && (
          <p className="text-body text-ink">La vérification est momentanément indisponible. Réessayez dans quelques instants.</p>
        )}
        {r.kind === "not_found" && (
          <p className="text-lead text-ink">
            Aucune attestation ne correspond au numéro <strong className="font-semibold">{code.toUpperCase()}</strong>. Vérifiez
            la saisie : le numéro figure en bas à gauche de l'attestation.
          </p>
        )}
        {(r.kind === "valid" || r.kind === "revoked") && (
          <>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-small font-semibold ${
                r.kind === "valid" ? "bg-emeraude-soft text-forest" : "border border-danger/40 bg-white text-danger"
              }`}
            >
              <span aria-hidden="true">{r.kind === "valid" ? "✓" : "✕"}</span>
              {r.kind === "valid"
                ? "Cette attestation a bien été délivrée par les organisateurs."
                : "Cette attestation a été révoquée par les organisateurs et n'est plus valable."}
            </div>
            <dl className="mt-8 grid gap-x-8 gap-y-4 rounded-2xl border border-line bg-white p-6 sm:grid-cols-[auto_1fr]">
              <dt className="text-small font-semibold text-ink-muted">Numéro</dt>
              <dd className="font-semibold text-ink">{r.code}</dd>
              <dt className="text-small font-semibold text-ink-muted">Titulaire</dt>
              <dd className="text-ink">{r.holder}</dd>
              <dt className="text-small font-semibold text-ink-muted">Webinaire</dt>
              <dd className="text-ink">« {r.title} »</dd>
              {r.date && (
                <>
                  <dt className="text-small font-semibold text-ink-muted">Date</dt>
                  <dd className="text-ink first-letter:uppercase">{r.date}</dd>
                </>
              )}
              <dt className="text-small font-semibold text-ink-muted">Organisateurs</dt>
              <dd className="text-ink">{r.organizers.map((o) => `${o.name} (${o.country})`).join(", ")}</dd>
              {r.issued_at && (
                <>
                  <dt className="text-small font-semibold text-ink-muted">Délivrée le</dt>
                  <dd className="text-ink">{fmt(r.issued_at)}</dd>
                </>
              )}
            </dl>
            <p className="mt-4 text-small text-ink-muted">
              Seules ces informations sont publiées. Il s'agit d'une attestation de participation, sans valeur de diplôme ni
              de certification.
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}
