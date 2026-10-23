import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { event } from "../config/event";
import { callFunction } from "../lib/backend";
import { type AdminRow, COUNTRY_LABEL, formatDateTime, lastEmailLabel, STATUS_LABEL, supabase } from "./client";
import { downloadCsv } from "./csv";
import { SettingsPanel } from "./SettingsPanel";

const PAGE = 1000; // plafond par requête de l'API Supabase (api.max_rows)

async function loadAll(): Promise<AdminRow[]> {
  const rows: AdminRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase()
      .from("admin_registrations")
      .select("*")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as AdminRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

const fieldCls = "mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-small text-ink focus:border-forest";

export function Dashboard({ session }: { session: Session }) {
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rowMessage, setRowMessage] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRows(await loadAll());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    // Bornes de dates en heure du Bénin / Niger (UTC+1).
    const min = from ? new Date(`${from}T00:00:00+01:00`).getTime() : -Infinity;
    const max = to ? new Date(`${to}T23:59:59.999+01:00`).getTime() : Infinity;
    return rows.filter((r) => {
      if (country && r.country !== country) return false;
      if (status && r.status !== status) return false;
      const t = new Date(r.created_at).getTime();
      if (t < min || t > max) return false;
      if (!needle) return true;
      return [r.full_name, r.email, r.organisation, r.job_title, r.phone ?? ""].some((v) => v.toLowerCase().includes(needle));
    });
  }, [rows, q, country, status, from, to]);

  const stats = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      confirmed: all.filter((r) => r.status === "confirmed").length,
      pending: all.filter((r) => r.status === "pending_confirmation").length,
      byCountry: (["BJ", "NE", "other"] as const).map((c) => ({ c, n: all.filter((r) => r.country === c).length })),
    };
  }, [rows]);

  const resend = async (r: AdminRow) => {
    setBusyId(r.id);
    const { httpStatus, data } = await callFunction<{ status?: string; type?: string; error_code?: string }>(
      "admin-resend",
      { registration_id: r.id },
      session.access_token,
    );
    setBusyId(null);
    const text =
      httpStatus === 200
        ? data?.type === "event_details"
          ? "E-mail d'informations pratiques envoyé."
          : "E-mail de confirmation envoyé."
        : httpStatus === 502
          ? `Échec de l'envoi (${data?.error_code ?? "erreur inconnue"}).`
          : httpStatus === 401 || httpStatus === 403
            ? "Action refusée : session expirée ou accès non autorisé."
            : "Erreur temporaire, réessayez.";
    setRowMessage((m) => ({ ...m, [r.id]: { ok: httpStatus === 200, text } }));
    void refresh();
  };

  return (
    <div className="space-y-10">
      <section aria-labelledby="stats-title">
        <h1 id="stats-title" className="text-h2 text-forest">
          Inscriptions
        </h1>
        <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Inscrits", value: stats.total },
            { label: "Confirmés", value: stats.confirmed },
            { label: "En attente", value: stats.pending },
            ...stats.byCountry.map(({ c, n }) => ({ label: COUNTRY_LABEL[c], value: n })),
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-white p-4">
              <dt className="eyebrow text-ink-muted">{s.label}</dt>
              <dd className="mt-2 font-display text-h2 text-forest tabular-nums">{rows ? s.value : "–"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <SettingsPanel session={session} confirmedCount={stats.confirmed} />

      <section aria-labelledby="list-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="list-title" className="text-h3 text-forest">
            Liste des inscrits
          </h2>
          <button
            type="button"
            onClick={() => downloadCsv(filtered)}
            disabled={!filtered.length}
            className="inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-small font-semibold text-paper hover:bg-forest-deep disabled:opacity-50"
          >
            Exporter en CSV ({filtered.length})
          </button>
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-small font-semibold text-ink lg:col-span-2">
            Rechercher
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail, organisation…" className={fieldCls} />
          </label>
          <label className="text-small font-semibold text-ink">
            Pays
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={fieldCls}>
              <option value="">Tous</option>
              <option value="BJ">Bénin</option>
              <option value="NE">Niger</option>
              <option value="other">Autre</option>
            </select>
          </label>
          <label className="text-small font-semibold text-ink">
            Statut
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldCls}>
              <option value="">Tous</option>
              <option value="confirmed">Confirmée</option>
              <option value="pending_confirmation">En attente</option>
              <option value="cancelled">Annulée</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <label className="text-small font-semibold text-ink">
              Du
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldCls} />
            </label>
            <label className="text-small font-semibold text-ink">
              Au
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldCls} />
            </label>
          </div>
        </div>

        {loadError && (
          <p role="alert" className="mt-4 text-small text-danger">
            Impossible de charger les inscriptions.{" "}
            <button type="button" className="font-semibold underline" onClick={() => void refresh()}>
              Réessayer
            </button>
          </p>
        )}
        {!rows && !loadError && (
          <p role="status" className="mt-6 text-body text-ink-muted">
            Chargement…
          </p>
        )}
        {rows && (
          <p className="mt-4 text-small text-ink-muted" role="status">
            {filtered.length} inscription{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""} sur {rows.length}.
          </p>
        )}

        <ul className="mt-4 grid gap-3">
          {filtered.map((r) => (
            <li key={r.id} className="grid gap-4 rounded-2xl border border-line bg-white p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{r.full_name}</p>
                <p className="break-all text-small text-ink-muted">{r.email}</p>
                <p className="text-small text-ink-muted">
                  {r.job_title} · {r.organisation}
                </p>
              </div>
              <div className="text-small">
                <p className="text-ink">
                  {COUNTRY_LABEL[r.country]}
                  {r.phone ? ` · ${r.phone}` : ""}
                </p>
                <p className="text-ink-muted">Inscrit le {formatDateTime(r.created_at)}</p>
                {r.marketing_consent && <p className="text-ink-muted">Accepte les communications</p>}
              </div>
              <div className="text-small">
                <p className={r.status === "confirmed" ? "font-semibold text-forest" : "font-semibold text-ink"}>
                  {STATUS_LABEL[r.status]}
                </p>
                <p className={r.last_email_status === "failed" ? "text-danger" : "text-ink-muted"}>
                  {lastEmailLabel(r)}
                  {r.last_email_at ? ` · ${formatDateTime(r.last_email_at)}` : ""}
                </p>
              </div>
              <div className="md:text-right">
                {r.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => void resend(r)}
                    disabled={busyId === r.id}
                    aria-label={`Renvoyer l'e-mail à ${r.full_name}`}
                    className="inline-flex min-h-10 items-center rounded-full border border-forest px-4 text-small font-semibold text-forest hover:bg-forest hover:text-paper disabled:cursor-wait disabled:opacity-60"
                  >
                    {busyId === r.id ? "Envoi…" : "Renvoyer l'e-mail"}
                  </button>
                )}
                {rowMessage[r.id] && (
                  <p role="status" className={`mt-2 text-small ${rowMessage[r.id]!.ok ? "text-forest" : "text-danger"}`}>
                    {rowMessage[r.id]!.text}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
