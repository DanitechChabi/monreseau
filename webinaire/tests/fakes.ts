import { EMPTY_SETTINGS, event, type EventSettings } from "../supabase/functions/_shared/event.ts";
import type { ServerConfig } from "../supabase/functions/_shared/config.ts";
import type { Deps } from "../supabase/functions/_shared/handlers/common.ts";
import type { Mailer, OutgoingEmail, SendResult } from "../supabase/functions/_shared/mailer.ts";
import type { ConfirmResult, EmailType, RegistrationRecord, Repo } from "../supabase/functions/_shared/repo.ts";
import type { RegistrationInput } from "../supabase/functions/_shared/validation.ts";

type Row = RegistrationRecord & RegistrationInput & { created_at: Date };
type Token = { registration_id: string; token_hash: string; expires_at: Date; used_at: Date | null };
type Log = { id: number; registration_id: string | null; type: EmailType; reference: string | null; status: string; error_code?: string | null };

/** Base en mémoire reproduisant la sémantique des fonctions SQL. */
export class MemoryRepo implements Repo {
  registrations: Row[] = [];
  tokens: Token[] = [];
  logs: Log[] = [];
  limits = new Map<string, { start: number; count: number }>();
  settings: EventSettings = { ...EMPTY_SETTINGS };
  admins = new Set<string>(["admin@archivexa.example"]);
  sessions = new Map<string, string>([
    ["jwt-admin", "admin@archivexa.example"],
    ["jwt-intrus", "intrus@example.org"],
  ]);
  constructor(private readonly clock: () => Date) {}

  async rateLimitHit(key: string, action: string, windowSeconds: number, max: number) {
    const k = `${key}|${action}`;
    const nowMs = this.clock().getTime();
    const cur = this.limits.get(k);
    const next = !cur || cur.start <= nowMs - windowSeconds * 1000 ? { start: nowMs, count: 1 } : { ...cur, count: cur.count + 1 };
    this.limits.set(k, next);
    return next.count <= max;
  }
  async registerParticipant(eventId: string, input: RegistrationInput) {
    const existing = this.registrations.find((r) => r.event_id === eventId && r.email === input.email);
    if (existing) return { registration: this.pick(existing), created: false };
    const row: Row = { ...input, id: crypto.randomUUID(), event_id: eventId, status: "pending_confirmation", created_at: this.clock() };
    this.registrations.push(row);
    return { registration: this.pick(row), created: true };
  }
  private pick(r: Row): RegistrationRecord {
    return { id: r.id, event_id: r.event_id, full_name: r.full_name, email: r.email, status: r.status };
  }
  async findRegistrationByEmail(eventId: string, email: string) {
    const r = this.registrations.find((x) => x.event_id === eventId && x.email === email);
    return r ? this.pick(r) : null;
  }
  async findRegistrationById(id: string) {
    const r = this.registrations.find((x) => x.id === id);
    return r ? this.pick(r) : null;
  }
  async issueConfirmationToken(registrationId: string, tokenHash: string, expiresAt: Date) {
    this.tokens = this.tokens.filter((t) => t.registration_id !== registrationId);
    this.tokens.push({ registration_id: registrationId, token_hash: tokenHash, expires_at: expiresAt, used_at: null });
  }
  async confirmToken(tokenHash: string): Promise<ConfirmResult> {
    const t = this.tokens.find((x) => x.token_hash === tokenHash);
    if (!t || t.used_at) return "invalid";
    const r = this.registrations.find((x) => x.id === t.registration_id)!;
    if (r.status === "cancelled") return "invalid";
    if (t.expires_at <= this.clock()) return "expired";
    t.used_at = this.clock();
    r.status = "confirmed";
    return "ok";
  }
  async startEmailLog(e: { registrationId: string | null; type: EmailType; reference?: string | null }) {
    const id = this.logs.length + 1;
    this.logs.push({ id, registration_id: e.registrationId, type: e.type, reference: e.reference ?? null, status: "pending" });
    return id;
  }
  async finishEmailLog(id: number, r: { status: "sent" | "failed"; errorCode?: string | null }) {
    const log = this.logs.find((l) => l.id === id)!;
    log.status = r.status;
    log.error_code = r.errorCode ?? null;
  }
  async getEventSettings() {
    return this.settings;
  }
  async isAdmin(email: string) {
    return this.admins.has(email);
  }
  async emailFromAccessToken(token: string) {
    return this.sessions.get(token) ?? null;
  }
  magicLinks: string[] = [];
  async createMagicLink(email: string, redirectTo: string) {
    const link = `https://auth.example/verify?email=${encodeURIComponent(email)}&redirect_to=${encodeURIComponent(redirectTo)}`;
    this.magicLinks.push(link);
    return link;
  }
  async listConfirmedMissingEmail(eventId: string, type: EmailType, reference: string) {
    return this.registrations
      .filter((r) => r.event_id === eventId && r.status === "confirmed")
      .filter((r) => !this.logs.some((l) => l.registration_id === r.id && l.type === type && l.reference === reference && l.status === "sent"))
      .map((r) => this.pick(r));
  }
  async purgeExpired() {
    return 0;
  }
}

/** Resend simulé : enregistre les messages, peut échouer à la demande. */
export class FakeMailer implements Mailer {
  sent: OutgoingEmail[] = [];
  failWith: string | null = null;
  async send(e: OutgoingEmail): Promise<SendResult> {
    if (this.failWith) return { ok: false, code: this.failWith };
    // Comme Resend : une clé d'idempotence déjà vue ne renvoie pas de message.
    if (!this.sent.some((s) => s.idempotencyKey === e.idempotencyKey)) this.sent.push(e);
    return { ok: true, id: `msg_${this.sent.length}` };
  }
  async sendBatch(emails: OutgoingEmail[]) {
    if (this.failWith) return { ok: false as const, code: this.failWith };
    this.sent.push(...emails);
    return { ok: true as const, ids: emails.map((_, i) => `batch_${i}`) };
  }
}

export const testConfig: ServerConfig = {
  supabaseUrl: "https://projet.supabase.co",
  serviceRoleKey: "service-role-de-test",
  resendApiKey: "re_test",
  emailFrom: "Webinaire <webinaire@example.org>",
  emailReplyTo: null,
  siteUrl: "https://webinaire.example",
  allowedOrigins: ["https://webinaire.example"],
  resendCooldownMinutes: 5,
  resendMaxPerEmailPerDay: 5,
  resendMaxPerIpPerHour: 20,
  registerMaxPerIpPerHour: 10,
  tokenTtlHours: 48,
  dataRetentionMonths: 12,
  attendanceMinMinutes: 45,
  attestationNameFormat: "first-initial",
  attestationBucket: "attestations",
};

export function setup(overrides: Partial<ServerConfig> = {}) {
  const clock = { now: new Date("2026-11-02T09:00:00Z") };
  const repo = new MemoryRepo(() => clock.now);
  const mailer = new FakeMailer();
  const deps: Deps = { repo, mailer, config: { ...testConfig, ...overrides }, event, now: () => clock.now, sleep: async () => {} };
  const advance = (minutes: number) => {
    clock.now = new Date(clock.now.getTime() + minutes * 60_000);
  };
  return { repo, mailer, deps, clock, advance };
}

export const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://projet.supabase.co/functions/v1/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://webinaire.example", "x-forwarded-for": "203.0.113.7", ...headers },
    body: JSON.stringify(body),
  });

export const validRegistration = {
  full_name: "Awa Diallo",
  email: "  Awa.Diallo@Example.ORG ",
  organisation: "Mairie de Parakou",
  job_title: "Archiviste",
  country: "BJ",
  phone: "+229 01 23 45 67 89",
  marketing_consent: false,
  website: "",
};

/** Jeton extrait du lien de confirmation contenu dans l'e-mail (texte brut). */
export function tokenFrom(email: OutgoingEmail): string {
  const m = /confirm\?token=([A-Za-z0-9_-]{43})/.exec(email.text);
  if (!m) throw new Error("lien de confirmation introuvable");
  return m[1]!;
}
