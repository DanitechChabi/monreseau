import type { AttendanceStatus, CertificateRecord, CertificateStatus, CertRepo, RegistrationLite } from "../supabase/functions/_shared/certificates/repo.ts";
import { type MemoryRepo, post, setup } from "./fakes.ts";

/** Présences, attestations, stockage et audit en mémoire (reliés aux inscriptions de MemoryRepo). */
export class MemoryCertRepo implements CertRepo {
  attendance = new Map<string, { status: AttendanceStatus; minutes: number | null; source: string; validatedBy: string }>();
  certificates: (CertificateRecord & { created: number })[] = [];
  files = new Map<string, Uint8Array>();
  auditLog: { action: string; admin: string; target: string | null; details: Record<string, unknown> }[] = [];
  private seq = 0;
  constructor(private readonly base: MemoryRepo) {}

  private lite(r: MemoryRepo["registrations"][number]): RegistrationLite {
    return { id: r.id, event_id: r.event_id, email: r.email, full_name: r.full_name, status: r.status };
  }
  async listRegistrations(eventId: string) {
    return this.base.registrations.filter((r) => r.event_id === eventId).map((r) => this.lite(r));
  }
  async getRegistration(id: string) {
    const r = this.base.registrations.find((x) => x.id === id);
    return r ? this.lite(r) : null;
  }
  async setAttendance(e: { registrationId: string; status: AttendanceStatus; minutes: number | null; source: "manual" | "csv"; validatedBy: string }) {
    this.attendance.set(e.registrationId, { status: e.status, minutes: e.minutes, source: e.source, validatedBy: e.validatedBy });
  }
  async getAttendanceStatus(id: string) {
    return this.attendance.get(id)?.status ?? null;
  }
  async certificateByRegistration(id: string) {
    return this.certificates.find((c) => c.registration_id === id) ?? null;
  }
  async certificateById(id: string) {
    return this.certificates.find((c) => c.id === id) ?? null;
  }
  async certificateByCode(code: string) {
    return this.certificates.find((c) => c.public_code === code) ?? null;
  }
  async insertCertificate(c: { registrationId: string; holderName: string; publicCode: string }) {
    if (this.certificates.some((x) => x.public_code === c.publicCode)) return null;
    const existing = this.certificates.find((x) => x.registration_id === c.registrationId);
    if (existing) return existing;
    const rec = {
      id: crypto.randomUUID(),
      public_code: c.publicCode,
      registration_id: c.registrationId,
      holder_name: c.holderName,
      status: "eligible" as CertificateStatus,
      revoked_reason: null,
      file_path: null,
      event_date: null,
      issued_at: null,
      sent_at: null,
      send_attempts: 0,
      last_error: null,
      created: this.seq++,
    };
    this.certificates.push(rec);
    return rec;
  }
  async deleteCertificate(id: string) {
    this.certificates = this.certificates.filter((c) => c.id !== id);
  }
  async updateCertificate(id: string, patch: Partial<CertificateRecord>) {
    const c = this.certificates.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
  }
  async listCertificates(status: CertificateStatus, limit: number) {
    return this.certificates.filter((c) => c.status === status).slice(0, limit).map((c) => ({ ...c }));
  }
  async countCertificates(status: CertificateStatus) {
    return this.certificates.filter((c) => c.status === status).length;
  }
  async putPdf(path: string, bytes: Uint8Array, overwrite: boolean) {
    if (this.files.has(path) && !overwrite) throw new Error("exists");
    this.files.set(path, bytes);
  }
  async getPdf(path: string) {
    const f = this.files.get(path);
    if (!f) throw new Error("missing");
    return f;
  }
  async signedUrl(path: string) {
    return `https://storage.example/signed/${path}?token=x`;
  }
  async audit(action: string, admin: string, target: string | null, details: Record<string, unknown>) {
    this.auditLog.push({ action, admin, target, details });
  }
}

/** Environnement de test : date du webinaire renseignée, un administrateur connecté. */
export function setupCerts() {
  const s = setup();
  const certs = new MemoryCertRepo(s.repo);
  s.deps.certs = certs;
  s.repo.settings = { ...s.repo.settings, date: "2026-12-03", time: "10:00" };
  const admin = { authorization: "Bearer jwt-admin" };
  return { ...s, certs, admin };
}

/** Inscrit directement une personne (sans passer par l'e-mail de confirmation). */
export async function addRegistrant(repo: MemoryRepo, email: string, full_name: string) {
  const { registration } = await repo.registerParticipant("maitrise-information-2026", {
    full_name,
    email,
    organisation: "Mairie",
    job_title: "Archiviste",
    country: "BJ",
    phone: null,
    marketing_consent: false,
  });
  return registration;
}

export const adminPost = (path: string, body: unknown, headers: Record<string, string> = { authorization: "Bearer jwt-admin" }) =>
  post(path, body, headers);
