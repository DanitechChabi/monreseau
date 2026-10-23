import type { Session } from "@supabase/supabase-js";
import { useEffect, useState, type FormEvent } from "react";
import { event } from "../config/event";
import { callFunction } from "../lib/backend";
import { formatDateTime, supabase } from "./client";

type Settings = {
  event_date: string;
  event_time: string;
  qa_duration_minutes: string;
  join_url: string;
  contact_email: string;
  updated_at: string | null;
  updated_by: string | null;
};

const fieldCls = "mt-1 block min-h-11 w-full rounded-xl border border-line bg-white px-3 text-body text-ink focus:border-forest";

/**
 * Réglages publiés sur le site et dans les e-mails : tant qu'un champ est vide,
 * rien ne s'affiche. L'écriture est contrôlée par la RLS (is_admin()).
 */
export function SettingsPanel({ session, confirmedCount }: { session: Session; confirmedCount: number }) {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [announcing, setAnnouncing] = useState(false);
  const [announceMsg, setAnnounceMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const { data, error } = await supabase().from("event_settings").select("*").eq("event_id", event.id).maybeSingle();
    if (error || !data) {
      setMessage({ ok: false, text: "Impossible de charger les réglages." });
      return;
    }
    setS({
      event_date: data.event_date ?? "",
      event_time: data.event_time ? String(data.event_time).slice(0, 5) : "",
      qa_duration_minutes: data.qa_duration_minutes ? String(data.qa_duration_minutes) : "",
      join_url: data.join_url ?? "",
      contact_email: data.contact_email ?? "",
      updated_at: data.updated_at,
      updated_by: data.updated_by,
    });
  };
  useEffect(() => {
    void load();
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!s) return;
    if (s.join_url && !/^https:\/\/\S+$/.test(s.join_url)) {
      setMessage({ ok: false, text: "Le lien de participation doit commencer par https://" });
      return;
    }
    setSaving(true);
    const { error, count } = await supabase()
      .from("event_settings")
      .update(
        {
          event_date: s.event_date || null,
          event_time: s.event_time || null,
          qa_duration_minutes: s.qa_duration_minutes ? Number(s.qa_duration_minutes) : null,
          join_url: s.join_url.trim() || null,
          contact_email: s.contact_email.trim().toLowerCase() || null,
        },
        { count: "exact" },
      )
      .eq("event_id", event.id);
    setSaving(false);
    if (error || count === 0) setMessage({ ok: false, text: "Enregistrement refusé ou impossible. Vérifiez les valeurs saisies." });
    else {
      setMessage({ ok: true, text: "Réglages enregistrés : ils sont visibles sur le site." });
      void load();
    }
  };

  const announce = async () => {
    setAnnounceMsg(null);
    setAnnouncing(true);
    const preview = await callFunction<{ status?: string; count?: number }>("admin-announce", { dry_run: true }, session.access_token);
    if (preview.httpStatus === 409) {
      setAnnouncing(false);
      setAnnounceMsg({ ok: false, text: "Renseignez et enregistrez d'abord la date et l'heure." });
      return;
    }
    if (preview.httpStatus !== 200) {
      setAnnouncing(false);
      setAnnounceMsg({ ok: false, text: "Impossible de préparer l'envoi. Réessayez." });
      return;
    }
    const n = preview.data?.count ?? 0;
    if (n === 0) {
      setAnnouncing(false);
      setAnnounceMsg({ ok: true, text: "Tous les inscrits confirmés ont déjà reçu ces informations." });
      return;
    }
    if (!window.confirm(`Envoyer la date, l'heure et le lien à ${n} inscrit(s) confirmé(s) ?`)) {
      setAnnouncing(false);
      return;
    }
    const { httpStatus, data } = await callFunction<{ sent?: number; failed?: number }>("admin-announce", {}, session.access_token);
    setAnnouncing(false);
    setAnnounceMsg(
      httpStatus === 200
        ? { ok: true, text: `${data?.sent ?? 0} e-mail(s) envoyé(s).` }
        : { ok: false, text: `${data?.sent ?? 0} envoyé(s), ${data?.failed ?? "?"} en échec. Relancez pour réessayer les échecs.` },
    );
  };

  const set = (k: keyof Settings) => (e: { target: { value: string } }) => s && setS({ ...s, [k]: e.target.value });

  return (
    <section aria-labelledby="settings-title" className="rounded-2xl border border-line bg-white p-6">
      <h2 id="settings-title" className="text-h3 text-forest">
        Date et informations pratiques
      </h2>
      <p className="mt-2 text-small text-ink-muted">
        Laissez un champ vide tant qu'il n'est pas confirmé : il n'apparaîtra ni sur le site ni dans les e-mails. Heure du
        Bénin et du Niger (UTC+1).
      </p>
      {!s ? (
        <p role="status" className="mt-4 text-small text-ink-muted">
          {message?.text ?? "Chargement…"}
        </p>
      ) : (
        <form onSubmit={save} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-small font-semibold text-ink">
            Date
            <input type="date" value={s.event_date} onChange={set("event_date")} className={fieldCls} />
          </label>
          <label className="text-small font-semibold text-ink">
            Heure de début
            <input type="time" value={s.event_time} onChange={set("event_time")} className={fieldCls} />
          </label>
          <label className="text-small font-semibold text-ink">
            Durée des questions-réponses (min)
            <input type="number" min={1} max={600} value={s.qa_duration_minutes} onChange={set("qa_duration_minutes")} className={fieldCls} />
          </label>
          <label className="text-small font-semibold text-ink sm:col-span-2">
            Lien de participation (envoyé par e-mail uniquement)
            <input type="url" placeholder="https://…" value={s.join_url} onChange={set("join_url")} className={fieldCls} />
          </label>
          <label className="text-small font-semibold text-ink">
            E-mail de contact
            <input type="email" value={s.contact_email} onChange={set("contact_email")} className={fieldCls} />
          </label>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center rounded-full bg-forest px-5 text-small font-semibold text-paper hover:bg-forest-deep disabled:cursor-wait"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {s.updated_by && (
              <span className="text-small text-ink-muted">
                Modifié le {formatDateTime(s.updated_at)} par {s.updated_by}
              </span>
            )}
          </div>
          {message && (
            <p role="status" className={`text-small sm:col-span-2 lg:col-span-3 ${message.ok ? "text-forest" : "text-danger"}`}>
              {message.text}
            </p>
          )}
        </form>
      )}

      <div className="mt-8 border-t border-line pt-6">
        <h3 className="text-body font-semibold text-ink">Prévenir les inscrits</h3>
        <p className="mt-1 text-small text-ink-muted">
          Envoie la date, l'heure et, s'il est renseigné, le lien de participation aux {confirmedCount} inscrit(s) confirmé(s).
          Chaque personne ne reçoit qu'une fois une même version des informations.
        </p>
        <button
          type="button"
          onClick={() => void announce()}
          disabled={announcing}
          className="mt-4 inline-flex min-h-11 items-center rounded-full border border-forest px-5 text-small font-semibold text-forest hover:bg-forest hover:text-paper disabled:cursor-wait disabled:opacity-60"
        >
          {announcing ? "Envoi en cours…" : "Envoyer les informations aux inscrits confirmés"}
        </button>
        {announceMsg && (
          <p role="status" className={`mt-3 text-small ${announceMsg.ok ? "text-forest" : "text-danger"}`}>
            {announceMsg.text}
          </p>
        )}
      </div>
    </section>
  );
}
