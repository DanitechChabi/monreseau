import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { event } from "../config/event";
import { callFunction } from "../lib/backend";
import {
  type AttendanceAnalysis,
  guessColumns,
  parseCsv,
  parseDuration,
} from "../../supabase/functions/_shared/certificates/attendance.ts";
import { formatDateTime, supabase } from "./client";

type Row = {
  registration_id: string;
  full_name: string;
  email: string;
  organisation: string;
  country: string;
  registration_status: string;
  attendance_status: "present" | "absent" | null;
  minutes: number | null;
  attendance_source: "manual" | "csv" | null;
  validated_by: string | null;
  validated_at: string | null;
  certificate_id: string | null;
  public_code: string | null;
  holder_name: string | null;
  certificate_status: "eligible" | "issued" | "sent" | "revoked" | null;
  revoked_reason: string | null;
  issued_at: string | null;
  sent_at: string | null;
  send_attempts: number | null;
  last_error: string | null;
};
type Audit = { id: number; action: string; admin: string; target: string | null; details: Record<string, unknown>; created_at: string };

const CERT_LABEL: Record<string, string> = { eligible: "Éligible", issued: "Émise", sent: "Envoyée", revoked: "Révoquée" };
const AUDIT_LABEL: Record<string, string> = {
  "attendance.set": "Présence modifiée",
  "attendance.import": "Import CSV des présences",
  "certificate.generate": "Attestations générées",
  "certificate.send": "Attestations envoyées",
  "certificate.resend": "Attestation renvoyée",
  "certificate.revoke": "Attestation révoquée",
  "certificate.rename": "Nom corrigé",
};
const field = "mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-small text-ink focus:border-forest";
const btn = "inline-flex min-h-10 items-center rounded-full px-4 text-small font-semibold disabled:cursor-wait disabled:opacity-50";

async function loadRows(): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase()
      .from("admin_attendance")
      .select("*")
      .eq("event_id", event.id)
      .order("full_name")
      .range(from, from + 999);
    if (error) throw error;
    out.push(...(data as Row[]));
    if (data.length < 1000) return out;
  }
}

function csvCell(v: string) {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Présences et attestations. Toutes les écritures passent par les fonctions
 * admin-attendance / admin-certificates (contrôle serveur + journal d'audit).
 */
export function AttendancePanel({ session }: { session: Session }) {
  const token = session.access_token;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [presence, setPresence] = useState("");
  const [certStatus, setCertStatus] = useState("");

  const refresh = useCallback(async () => {
    try {
      setRows(await loadRows());
      const { data } = await supabase().from("audit_log").select("*").order("created_at", { ascending: false }).limit(40);
      setAudit((data as Audit[]) ?? []);
      setError(null);
    } catch {
      setError("Impossible de charger les présences.");
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (presence === "none" ? r.attendance_status !== null : presence && r.attendance_status !== presence) return false;
      if (certStatus === "none" ? r.certificate_status !== null : certStatus && r.certificate_status !== certStatus) return false;
      return !needle || [r.full_name, r.email, r.organisation, r.public_code ?? ""].some((v) => v.toLowerCase().includes(needle));
    });
  }, [rows, q, presence, certStatus]);

  const count = (pred: (r: Row) => boolean) => (rows ?? []).filter(pred).length;
  const stats = [
    { label: "Inscrits", value: count(() => true) },
    { label: "Présents", value: count((r) => r.attendance_status === "present") },
    { label: "Absents", value: count((r) => r.attendance_status === "absent") },
    { label: "Éligibles", value: count((r) => r.certificate_status === "eligible") },
    { label: "Émises", value: count((r) => r.certificate_status === "issued") },
    { label: "Envoyées", value: count((r) => r.certificate_status === "sent") },
  ];

  const call = async (fn: "admin-attendance" | "admin-certificates", payload: Record<string, unknown>) => {
    const res = await callFunction<Record<string, unknown>>(fn, payload, token);
    if (res.httpStatus === 401 || res.httpStatus === 403) throw new Error("Action refusée : session expirée ou accès non autorisé.");
    return res;
  };

  const run = async (key: string, task: () => Promise<string>) => {
    setBusy(key);
    setNotice(null);
    try {
      setNotice({ ok: true, text: await task() });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "Erreur temporaire, réessayez." });
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const setAttendance = (r: Row, status: "present" | "absent") =>
    run(`att-${r.registration_id}`, async () => {
      const { httpStatus, data } = await call("admin-attendance", { action: "set", registration_id: r.registration_id, status, minutes: r.minutes });
      if (httpStatus !== 200) throw new Error("La présence n'a pas pu être enregistrée.");
      const warn = (data?.warnings as { message: string }[] | undefined)?.[0]?.message;
      return warn ?? `${r.full_name} : ${status === "present" ? "présence validée" : "marqué(e) absent(e)"}.`;
    });

  const generateAll = () =>
    run("generate", async () => {
      let total = 0;
      for (let guard = 0; guard < 100; guard++) {
        const { httpStatus, data } = await call("admin-certificates", { action: "generate" });
        if (httpStatus === 409) throw new Error("Renseignez d'abord la date du webinaire (onglet Inscriptions › Date et informations pratiques).");
        if (httpStatus !== 200) throw new Error(`Génération interrompue après ${total} attestation(s). Relancez pour reprendre.`);
        total += Number(data?.generated ?? 0);
        if (!Number(data?.remaining) || !Number(data?.generated)) break;
      }
      return `${total} attestation(s) générée(s).`;
    });

  const sendAll = (ready: number) => {
    if (!window.confirm(`Envoyer ${ready} attestation(s) par e-mail, avec le PDF en pièce jointe ?`)) return;
    void run("send", async () => {
      let sent = 0;
      let failed = 0;
      for (let guard = 0; guard < 200; guard++) {
        const { httpStatus, data } = await call("admin-certificates", { action: "send" });
        if (httpStatus !== 200) throw new Error(`Envoi interrompu après ${sent} attestation(s). Relancez pour reprendre.`);
        sent += Number(data?.sent ?? 0);
        failed += (data?.failed as unknown[] | undefined)?.length ?? 0;
        // Un lot entièrement en échec : on s'arrête, les attestations restent prêtes pour une reprise.
        if (!Number(data?.remaining) || !Number(data?.sent)) break;
      }
      if (failed) throw new Error(`${sent} envoyée(s), ${failed} en échec. Les échecs restent « émises » : relancez l'envoi pour réessayer.`);
      return `${sent} attestation(s) envoyée(s).`;
    });
  };

  const certAction = (r: Row, action: "resend" | "revoke" | "rename" | "download") => {
    if (!r.certificate_id) return;
    if (action === "download")
      return run(`dl-${r.certificate_id}`, async () => {
        const { httpStatus, data } = await call("admin-certificates", { action: "download", id: r.certificate_id });
        if (httpStatus !== 200 || typeof data?.url !== "string") throw new Error("Le PDF n'est pas disponible.");
        window.open(data.url, "_blank", "noopener");
        return "Téléchargement du PDF lancé.";
      });
    if (action === "revoke") {
      const reason = window.prompt(`Motif de la révocation de l'attestation ${r.public_code} :`);
      if (!reason) return;
      return run(`rv-${r.certificate_id}`, async () => {
        const { httpStatus } = await call("admin-certificates", { action: "revoke", id: r.certificate_id, reason });
        if (httpStatus === 422) throw new Error("Indiquez un motif (3 caractères au moins).");
        if (httpStatus !== 200) throw new Error("La révocation a échoué.");
        return `Attestation ${r.public_code} révoquée.`;
      });
    }
    if (action === "rename") {
      const name = window.prompt("Nom tel qu'il doit figurer sur l'attestation :", r.holder_name ?? r.full_name);
      if (!name || name === r.holder_name) return;
      return run(`rn-${r.certificate_id}`, async () => {
        const { httpStatus, data } = await call("admin-certificates", { action: "rename", id: r.certificate_id, name });
        if (httpStatus !== 200) throw new Error("La correction a échoué (nom de 3 à 120 caractères).");
        return data?.regenerated ? "Nom corrigé, PDF régénéré avec le même numéro." : "Nom corrigé.";
      });
    }
    return run(`rs-${r.certificate_id}`, async () => {
      const { httpStatus, data } = await call("admin-certificates", { action: "resend", id: r.certificate_id });
      if (httpStatus !== 200) throw new Error(`Renvoi impossible (${String(data?.error_code ?? data?.status ?? "erreur")}).`);
      return `Attestation renvoyée à ${r.email}.`;
    });
  };

  const exportReport = () => {
    const header = ["Nom", "E-mail", "Organisation", "Présence", "Minutes", "Source", "Validée par", "Numéro", "Nom sur l'attestation", "Statut", "Émise le", "Envoyée le", "Motif de révocation", "Dernière erreur"];
    const lines = filtered.map((r) =>
      [
        r.full_name, r.email, r.organisation,
        r.attendance_status === "present" ? "présent" : r.attendance_status === "absent" ? "absent" : "",
        r.minutes?.toString() ?? "", r.attendance_source ?? "", r.validated_by ?? "", r.public_code ?? "", r.holder_name ?? "",
        r.certificate_status ? CERT_LABEL[r.certificate_status]! : "", formatDateTime(r.issued_at), formatDateTime(r.sent_at),
        r.revoked_reason ?? "", r.last_error ?? "",
      ].map(csvCell).join(";"),
    );
    const blob = new Blob(["﻿" + [header.map(csvCell).join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rapport-attestations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const eligible = count((r) => r.certificate_status === "eligible");
  const ready = count((r) => r.certificate_status === "issued");

  return (
    <div className="space-y-10">
      <section aria-labelledby="att-title">
        <h1 id="att-title" className="text-h2 text-forest">
          Présences et attestations
        </h1>
        <p className="mt-2 max-w-3xl text-small text-ink-muted">
          L'inscription ne donne jamais droit à une attestation : seule une présence validée ici ouvre ce droit.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-white p-4">
              <dt className="eyebrow text-ink-muted">{s.label}</dt>
              <dd className="mt-2 font-display text-h2 text-forest tabular-nums">{rows ? s.value : "–"}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={!!busy || !eligible} onClick={() => void generateAll()} className={`${btn} bg-forest text-paper hover:bg-forest-deep`}>
            {busy === "generate" ? "Génération…" : `Générer les attestations (${eligible} éligible${eligible > 1 ? "s" : ""})`}
          </button>
          <button type="button" disabled={!!busy || !ready} onClick={() => sendAll(ready)} className={`${btn} border border-forest text-forest hover:bg-forest hover:text-paper`}>
            {busy === "send" ? "Envoi en cours…" : `Envoyer les attestations (${ready} prête${ready > 1 ? "s" : ""})`}
          </button>
          <button type="button" disabled={!filtered.length} onClick={exportReport} className={`${btn} border border-line text-ink hover:border-forest`}>
            Exporter le rapport de délivrance (CSV)
          </button>
        </div>
        {notice && (
          <p role="status" className={`mt-4 text-small ${notice.ok ? "text-forest" : "text-danger"}`}>
            {notice.text}
          </p>
        )}
      </section>

      <CsvImport token={token} onDone={() => void refresh()} />

      <section aria-labelledby="att-list">
        <h2 id="att-list" className="text-h3 text-forest">
          Liste
        </h2>
        <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-3">
          <label className="text-small font-semibold text-ink">
            Rechercher
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail, numéro…" className={field} />
          </label>
          <label className="text-small font-semibold text-ink">
            Présence
            <select value={presence} onChange={(e) => setPresence(e.target.value)} className={field}>
              <option value="">Toutes</option>
              <option value="present">Présent</option>
              <option value="absent">Absent</option>
              <option value="none">Non renseignée</option>
            </select>
          </label>
          <label className="text-small font-semibold text-ink">
            Attestation
            <select value={certStatus} onChange={(e) => setCertStatus(e.target.value)} className={field}>
              <option value="">Tous statuts</option>
              <option value="none">Aucune</option>
              <option value="eligible">Éligible</option>
              <option value="issued">Émise</option>
              <option value="sent">Envoyée</option>
              <option value="revoked">Révoquée</option>
            </select>
          </label>
        </div>
        {error && <p role="alert" className="mt-4 text-small text-danger">{error}</p>}
        <p className="mt-4 text-small text-ink-muted" role="status">
          {rows ? `${filtered.length} personne(s) affichée(s) sur ${rows.length}.` : "Chargement…"}
        </p>
        <ul className="mt-3 grid gap-3">
          {filtered.map((r) => (
            <li key={r.registration_id} className="grid gap-4 rounded-2xl border border-line bg-white p-4 lg:grid-cols-[1.3fr_1fr_1.3fr] lg:items-center">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{r.full_name}</p>
                <p className="break-all text-small text-ink-muted">{r.email}</p>
                <p className="text-small text-ink-muted">{r.organisation}</p>
              </div>
              <div>
                <div className="flex gap-2" role="group" aria-label={`Présence de ${r.full_name}`}>
                  {(["present", "absent"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={r.attendance_status === s}
                      disabled={busy === `att-${r.registration_id}`}
                      onClick={() => void setAttendance(r, s)}
                      className={`${btn} border ${
                        r.attendance_status === s
                          ? s === "present"
                            ? "border-forest bg-forest text-paper"
                            : "border-danger bg-danger text-white"
                          : "border-line text-ink hover:border-forest"
                      }`}
                    >
                      {s === "present" ? "Présent" : "Absent"}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[0.75rem] text-ink-muted">
                  {r.attendance_status
                    ? `${r.minutes != null ? `${r.minutes} min · ` : ""}${r.attendance_source === "csv" ? "import CSV" : "manuel"} · ${formatDateTime(r.validated_at)}`
                    : "Présence non renseignée"}
                </p>
              </div>
              <div className="text-small">
                {r.certificate_status ? (
                  <>
                    <p>
                      <span className={`font-semibold ${r.certificate_status === "revoked" ? "text-danger" : "text-forest"}`}>
                        {CERT_LABEL[r.certificate_status]}
                      </span>{" "}
                      <span className="text-ink-muted">· {r.public_code}</span>
                    </p>
                    {r.holder_name !== r.full_name && <p className="text-ink-muted">Nom : {r.holder_name}</p>}
                    {r.revoked_reason && <p className="text-danger">Motif : {r.revoked_reason}</p>}
                    {r.last_error && r.certificate_status === "issued" && <p className="text-danger">Dernier envoi en échec ({r.last_error})</p>}
                    {r.certificate_status !== "revoked" && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {(r.certificate_status === "issued" || r.certificate_status === "sent") && (
                          <>
                            <button type="button" className="font-semibold text-forest underline" onClick={() => void certAction(r, "download")}>Télécharger</button>
                            <button type="button" className="font-semibold text-forest underline" onClick={() => void certAction(r, "resend")}>
                              {r.certificate_status === "sent" ? "Renvoyer" : "Envoyer"}
                            </button>
                          </>
                        )}
                        <button type="button" className="font-semibold text-forest underline" onClick={() => void certAction(r, "rename")}>Corriger le nom</button>
                        {r.certificate_status !== "eligible" && (
                          <button type="button" className="font-semibold text-danger underline" onClick={() => void certAction(r, "revoke")}>Révoquer</button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-ink-muted">Aucune attestation</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="audit-title" className="rounded-2xl border border-line bg-white p-6">
        <h2 id="audit-title" className="text-h3 text-forest">
          Journal d'audit
        </h2>
        {audit.length === 0 ? (
          <p className="mt-3 text-small text-ink-muted">Aucune action enregistrée pour l'instant.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line text-small">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-ink">
                  <strong className="font-semibold">{AUDIT_LABEL[a.action] ?? a.action}</strong>
                  {a.target && <span className="text-ink-muted"> · {a.target}</span>}
                  {a.action === "certificate.rename" && <span className="text-ink-muted"> · « {String(a.details.from)} » → « {String(a.details.to)} »</span>}
                  {a.action === "certificate.revoke" && <span className="text-ink-muted"> · {String(a.details.reason)}</span>}
                  {a.action === "attendance.import" && (
                    <span className="text-ink-muted">
                      {" "}· {String(a.details.validated)} validée(s), {String(a.details.below_threshold)} sous le seuil
                    </span>
                  )}
                </span>
                <span className="text-ink-muted">
                  {a.admin} · {formatDateTime(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Import CSV : lecture locale, choix des colonnes, aperçu du rapprochement, puis validation. */
function CsvImport({ token, onDone }: { token: string; onDone: () => void }) {
  const [table, setTable] = useState<string[][] | null>(null);
  const [cols, setCols] = useState({ email: -1, name: -1, minutes: -1 });
  const [headerRow, setHeaderRow] = useState(0);
  const [analysis, setAnalysis] = useState<AttendanceAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const header = table?.[headerRow] ?? [];
  const data = table ? table.slice(headerRow + 1) : [];

  const onFile = async (f: File | undefined) => {
    setAnalysis(null);
    setMessage(null);
    if (!f) return;
    const t = parseCsv(await f.text());
    // Certaines plateformes (Teams, Zoom) ajoutent un bloc récapitulatif avant le tableau : on cherche la ligne d'en-tête.
    const hi = Math.max(0, t.findIndex((r) => guessColumns(r).email >= 0));
    setTable(t);
    setHeaderRow(hi);
    setCols(guessColumns(t[hi] ?? []));
  };

  const rows = () =>
    data.map((r) => ({
      email: r[cols.email] ?? "",
      name: cols.name >= 0 ? (r[cols.name] ?? "") : "",
      minutes: cols.minutes >= 0 ? parseDuration(r[cols.minutes] ?? "") : null,
    }));

  const send = async (action: "analyze" | "import") => {
    setBusy(true);
    setMessage(null);
    const { httpStatus, data: res } = await callFunction<AttendanceAnalysis & { validated?: number }>("admin-attendance", { action, rows: rows() }, token);
    setBusy(false);
    if (httpStatus !== 200 || !res) return setMessage({ ok: false, text: "Le fichier n'a pas pu être traité (session expirée ou fichier trop volumineux ?)." });
    setAnalysis(res);
    if (action === "import") {
      setMessage({ ok: true, text: `${res.validated ?? 0} présence(s) validée(s). Les lignes sous le seuil restent à arbitrer manuellement.` });
      onDone();
    }
  };

  const ok = analysis?.matched.filter((m) => m.meetsThreshold) ?? [];
  const below = analysis?.matched.filter((m) => !m.meetsThreshold) ?? [];

  return (
    <section aria-labelledby="csv-title" className="rounded-2xl border border-line bg-white p-6">
      <h2 id="csv-title" className="text-h3 text-forest">
        Importer la liste de présence (CSV)
      </h2>
      <p className="mt-2 text-small text-ink-muted">
        Export de Zoom, Google Meet ou Microsoft Teams. Rapprochement par adresse e-mail ; les reconnexions sont additionnées.
        Seules les personnes au-dessus du seuil sont validées, les autres sont signalées.
      </p>
      <input type="file" accept=".csv,.txt,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} className="mt-4 block text-small" />

      {table && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="text-small font-semibold text-ink">
              Ligne d'en-tête
              <select value={headerRow} onChange={(e) => { setHeaderRow(Number(e.target.value)); setCols(guessColumns(table[Number(e.target.value)] ?? [])); setAnalysis(null); }} className={field}>
                {table.slice(0, 15).map((r, i) => (
                  <option key={i} value={i}>{`Ligne ${i + 1} : ${r.slice(0, 3).join(" | ").slice(0, 40)}`}</option>
                ))}
              </select>
            </label>
            {(["email", "name", "minutes"] as const).map((k) => (
              <label key={k} className="text-small font-semibold text-ink">
                Colonne {k === "email" ? "e-mail" : k === "name" ? "nom" : "durée"}
                <select value={cols[k]} onChange={(e) => { setCols({ ...cols, [k]: Number(e.target.value) }); setAnalysis(null); }} className={field}>
                  <option value={-1}>{k === "email" ? "Choisir…" : "Aucune"}</option>
                  {header.map((h, i) => (
                    <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-small">
              <thead className="bg-paper text-ink-muted">
                <tr>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Nom</th>
                  <th className="px-3 py-2">Durée lue</th>
                </tr>
              </thead>
              <tbody>
                {rows().slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-2">{r.email}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">{r.minutes != null ? `${r.minutes} min` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[0.75rem] text-ink-muted">Aperçu des 5 premières lignes sur {data.length}.</p>
          <button type="button" disabled={busy || cols.email < 0} onClick={() => void send("analyze")} className={`${btn} mt-4 border border-forest text-forest hover:bg-forest hover:text-paper`}>
            {busy ? "Analyse…" : "Analyser le fichier"}
          </button>
        </>
      )}

      {analysis && (
        <div className="mt-6 space-y-3 text-small">
          <p className="text-ink">
            Seuil : <strong>{analysis.threshold} min</strong> · <strong className="text-forest">{ok.length}</strong> à valider ·{" "}
            <strong className="text-danger">{below.length}</strong> sous le seuil · {analysis.unmatched.length} non inscrit(s) ·{" "}
            {analysis.duplicates.length} doublon(s) fusionné(s) · {analysis.invalid} ligne(s) sans e-mail
          </p>
          {below.length > 0 && (
            <details className="rounded-xl border border-danger/30 p-3">
              <summary className="cursor-pointer font-semibold text-danger">Sous le seuil (non validés automatiquement)</summary>
              <ul className="mt-2 space-y-1">
                {below.map((m) => (
                  <li key={m.email}>{m.registeredName} · {m.email} · {m.minutes ?? "durée inconnue"} {m.minutes != null ? "min" : ""}</li>
                ))}
              </ul>
            </details>
          )}
          {analysis.unmatched.length > 0 && (
            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer font-semibold text-ink">Présents dans le fichier mais non inscrits</summary>
              <ul className="mt-2 space-y-1">
                {analysis.unmatched.map((u) => (
                  <li key={u.email}>{u.name || "—"} · {u.email}</li>
                ))}
              </ul>
            </details>
          )}
          <button type="button" disabled={busy || !ok.length} onClick={() => void send("import")} className={`${btn} bg-forest text-paper hover:bg-forest-deep`}>
            {busy ? "Validation…" : `Valider ${ok.length} présence(s)`}
          </button>
        </div>
      )}
      {message && <p role="status" className={`mt-4 text-small ${message.ok ? "text-forest" : "text-danger"}`}>{message.text}</p>}
    </section>
  );
}
