import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "../lib/backend";

let client: SupabaseClient | null = null;

/** Client Supabase (clé anon) — chargé uniquement sur /admin. */
export function supabase(): SupabaseClient {
  client ??= createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
  });
  return client;
}

export type AdminRow = {
  id: string;
  full_name: string;
  email: string;
  organisation: string;
  job_title: string;
  country: "BJ" | "NE" | "other";
  phone: string | null;
  status: "pending_confirmation" | "confirmed" | "cancelled";
  email_confirmed_at: string | null;
  marketing_consent: boolean;
  created_at: string;
  last_email_type: "confirmation" | "event_details" | "admin_login" | null;
  last_email_status: "pending" | "sent" | "failed" | null;
  last_email_error: string | null;
  last_email_at: string | null;
};

export const COUNTRY_LABEL: Record<AdminRow["country"], string> = { BJ: "Bénin", NE: "Niger", other: "Autre" };
export const STATUS_LABEL: Record<AdminRow["status"], string> = {
  pending_confirmation: "En attente de confirmation",
  confirmed: "Confirmée",
  cancelled: "Annulée",
};
const EMAIL_TYPE: Record<string, string> = {
  confirmation: "Confirmation",
  event_details: "Informations pratiques",
  admin_login: "Connexion",
};
const EMAIL_STATUS: Record<string, string> = { pending: "en attente", sent: "envoyé", failed: "échec" };

export function lastEmailLabel(r: AdminRow): string {
  if (!r.last_email_status) return "Aucun envoi";
  const base = `${EMAIL_TYPE[r.last_email_type ?? ""] ?? "E-mail"} : ${EMAIL_STATUS[r.last_email_status]}`;
  return r.last_email_status === "failed" && r.last_email_error ? `${base} (${r.last_email_error})` : base;
}

export const formatDateTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Porto-Novo" }).format(new Date(iso))
    : "";
