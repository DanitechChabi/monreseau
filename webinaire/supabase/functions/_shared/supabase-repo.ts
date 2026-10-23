// Implémentation Deno de Repo (clé service_role). Non importée par les tests Node.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import type { AttendanceStatus, CertificateRecord, CertificateStatus, CertRepo, RegistrationLite } from "./certificates/repo.ts";
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

/* ---------- Passe 3 : présences, attestations, stockage, audit ---------- */


const CERT_COLS =
  "id, public_code, registration_id, holder_name, status, revoked_reason, file_path, event_date, issued_at, sent_at, send_attempts, last_error";

export class SupabaseCertRepo implements CertRepo {
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string, private readonly bucket: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async listRegistrations(eventId: string) {
    const out: RegistrationLite[] = [];
    for (let from = 0; ; from += 1000) {
      const page = check(
        await this.db.from("registrations").select("id, event_id, email, full_name, status").eq("event_id", eventId).range(from, from + 999),
      ) as RegistrationLite[];
      out.push(...page);
      if (page.length < 1000) return out;
    }
  }

  async getRegistration(id: string) {
    return check(
      await this.db.from("registrations").select("id, event_id, email, full_name, status").eq("id", id).maybeSingle(),
    ) as RegistrationLite | null;
  }

  async setAttendance(e: { registrationId: string; status: AttendanceStatus; minutes: number | null; source: "manual" | "csv"; validatedBy: string }) {
    check(
      await this.db.from("attendance").upsert({
        registration_id: e.registrationId,
        status: e.status,
        minutes: e.minutes,
        source: e.source,
        validated_by: e.validatedBy,
        validated_at: new Date().toISOString(),
      }),
    );
  }

  async getAttendanceStatus(registrationId: string) {
    const row = check(await this.db.from("attendance").select("status").eq("registration_id", registrationId).maybeSingle()) as {
      status: AttendanceStatus;
    } | null;
    return row?.status ?? null;
  }

  private async one(col: string, value: string) {
    return check(await this.db.from("certificates").select(CERT_COLS).eq(col, value).maybeSingle()) as CertificateRecord | null;
  }
  certificateByRegistration(id: string) {
    return this.one("registration_id", id);
  }
  certificateById(id: string) {
    return this.one("id", id);
  }
  certificateByCode(code: string) {
    return this.one("public_code", code);
  }

  async insertCertificate(c: { registrationId: string; holderName: string; publicCode: string }) {
    const { data, error } = await this.db
      .from("certificates")
      .insert({ registration_id: c.registrationId, holder_name: c.holderName, public_code: c.publicCode })
      .select(CERT_COLS)
      .single();
    if (error) {
      // 23505 : violation d'unicité. Sur registration_id, l'attestation existe déjà.
      if (error.code === "23505" && error.message.includes("public_code")) return null;
      if (error.code === "23505") return await this.certificateByRegistration(c.registrationId);
      throw error;
    }
    return data as CertificateRecord;
  }

  async deleteCertificate(id: string) {
    check(await this.db.from("certificates").delete().eq("id", id));
  }

  async updateCertificate(id: string, patch: Partial<CertificateRecord>) {
    check(await this.db.from("certificates").update(patch).eq("id", id));
  }

  async listCertificates(status: CertificateStatus, limit: number) {
    return check(
      await this.db.from("certificates").select(CERT_COLS).eq("status", status).order("created_at").limit(limit),
    ) as CertificateRecord[];
  }

  async countCertificates(status: CertificateStatus) {
    const { count, error } = await this.db.from("certificates").select("id", { count: "exact", head: true }).eq("status", status);
    if (error) throw error;
    return count ?? 0;
  }

  async putPdf(path: string, bytes: Uint8Array, overwrite: boolean) {
    const { error } = await this.db.storage.from(this.bucket).upload(path, bytes, { contentType: "application/pdf", upsert: overwrite });
    if (error) throw error;
  }

  async getPdf(path: string) {
    const { data, error } = await this.db.storage.from(this.bucket).download(path);
    if (error || !data) throw error ?? new Error("pdf introuvable");
    return new Uint8Array(await data.arrayBuffer());
  }

  async signedUrl(path: string, seconds: number) {
    const { data, error } = await this.db.storage.from(this.bucket).createSignedUrl(path, seconds, { download: true });
    if (error || !data) throw error ?? new Error("lien indisponible");
    return data.signedUrl;
  }

  async audit(action: string, admin: string, target: string | null, details: Record<string, unknown>) {
    check(await this.db.from("audit_log").insert({ action, admin, target, details }));
  }
}
