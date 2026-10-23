// Implémentation Deno de Repo (clé service_role). Non importée par les tests Node.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import type { EventSettings } from "./event.ts";
import type { ConfirmResult, EmailType, RegistrationRecord, Repo } from "./repo.ts";
import type { RegistrationInput } from "./validation.ts";

function check<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data;
}

export class SupabaseRepo implements Repo {
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async rateLimitHit(key: string, action: string, windowSeconds: number, max: number) {
    return check(
      await this.db.rpc("rate_limit_hit", { p_key: key, p_action: action, p_window_seconds: windowSeconds, p_max: max }),
    ) as boolean;
  }

  async registerParticipant(eventId: string, i: RegistrationInput) {
    const rows = check(
      await this.db.rpc("register_participant", {
        p_event_id: eventId,
        p_full_name: i.full_name,
        p_email: i.email,
        p_organisation: i.organisation,
        p_job_title: i.job_title,
        p_country: i.country,
        p_phone: i.phone,
        p_marketing_consent: i.marketing_consent,
      }),
    ) as (RegistrationRecord & { created: boolean })[];
    const row = rows[0];
    if (!row) throw new Error("register_participant: aucune ligne");
    const { created, ...registration } = row;
    return { registration, created };
  }

  private readonly cols = "id, event_id, full_name, email, status";

  async findRegistrationByEmail(eventId: string, email: string) {
    return check(
      await this.db.from("registrations").select(this.cols).eq("event_id", eventId).eq("email", email).maybeSingle(),
    ) as RegistrationRecord | null;
  }

  async findRegistrationById(id: string) {
    return check(await this.db.from("registrations").select(this.cols).eq("id", id).maybeSingle()) as RegistrationRecord | null;
  }

  async issueConfirmationToken(registrationId: string, tokenHash: string, expiresAt: Date) {
    check(
      await this.db.rpc("issue_confirmation_token", {
        p_registration_id: registrationId,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt.toISOString(),
      }),
    );
  }

  async confirmToken(tokenHash: string) {
    return check(await this.db.rpc("confirm_registration", { p_token_hash: tokenHash })) as ConfirmResult;
  }

  async startEmailLog(e: { registrationId: string | null; type: EmailType; reference?: string | null }) {
    const row = check(
      await this.db
        .from("email_log")
        .insert({ registration_id: e.registrationId, type: e.type, reference: e.reference ?? null, status: "pending" })
        .select("id")
        .single(),
    ) as { id: number };
    return row.id;
  }

  async finishEmailLog(id: number, r: { status: "sent" | "failed"; providerMessageId?: string | null; errorCode?: string | null }) {
    check(
      await this.db
        .from("email_log")
        .update({ status: r.status, provider_message_id: r.providerMessageId ?? null, error_code: r.errorCode ?? null })
        .eq("id", id),
    );
  }

  async getEventSettings(eventId: string): Promise<EventSettings> {
    const s = check(
      await this.db
        .from("event_settings")
        .select("event_date, event_time, qa_duration_minutes, join_url, contact_email")
        .eq("event_id", eventId)
        .maybeSingle(),
    ) as {
      event_date: string | null;
      event_time: string | null;
      qa_duration_minutes: number | null;
      join_url: string | null;
      contact_email: string | null;
    } | null;
    return {
      date: s?.event_date ?? null,
      time: s?.event_time ? s.event_time.slice(0, 5) : null,
      qaDurationMinutes: s?.qa_duration_minutes ?? null,
      joinUrl: s?.join_url ?? null,
      contactEmail: s?.contact_email ?? null,
    };
  }

  async isAdmin(email: string) {
    const row = check(await this.db.from("admins").select("email").eq("email", email).maybeSingle());
    return row !== null;
  }

  async emailFromAccessToken(accessToken: string) {
    const { data, error } = await this.db.auth.getUser(accessToken);
    if (error || !data.user?.email) return null;
    return data.user.email;
  }

  async createMagicLink(email: string, redirectTo: string) {
    // Crée le compte au premier usage (les inscriptions publiques à Auth sont désactivées).
    const created = await this.db.auth.admin.createUser({ email, email_confirm: true });
    if (created.error && created.error.status !== 422) throw created.error;
    const { data, error } = await this.db.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
    if (error) throw error;
    return data.properties.action_link;
  }

  async listConfirmedMissingEmail(eventId: string, type: EmailType, reference: string) {
    return check(
      await this.db.rpc("confirmed_missing_email", { p_event_id: eventId, p_type: type, p_reference: reference }),
    ) as RegistrationRecord[];
  }

  async purgeExpired(months: number) {
    return check(await this.db.rpc("purge_expired_data", { p_months: months })) as number;
  }
}
