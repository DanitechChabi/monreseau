/**
 * Présences et attestations (passe 3).
 *
 * - admin-attendance  : validation manuelle, analyse et import CSV des présences.
 * - admin-certificates: génération des PDF, envoi par lots, renvoi, révocation,
 *                       correction du nom, lien de téléchargement.
 * (La vérification publique est dans verify.ts, pour ne pas charger le générateur PDF.)
 *
 * Règle : seule une présence validée (status = present) crée une attestation
 * « eligible ». Une attestation émise n'est jamais régénérée, sauf correction de
 * nom tracée dans le journal d'audit.
 */
import { formatEventDate } from "../datetime.ts";
import { certificateEmail } from "../email/templates.ts";
import { json, readJson } from "../http.ts";
import { analyzeAttendance, type ImportRow } from "../certificates/attendance.ts";
import { generatePublicCode } from "../certificates/names.ts";
import { buildCertificatePdf } from "../certificates/pdf.ts";
import type { CertificateRecord, CertRepo } from "../certificates/repo.ts";
import { type Deps, currentEvent, logError, now } from "./common.ts";
import { preflight, requireAdmin } from "./admin.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH_MAX = 20;
/** ≈ 100 ms de calcul par PDF : 8 par appel reste sous la limite CPU des Edge Functions. */
const GENERATE_MAX = 8;
const IMPORT_MAX_BYTES = 2_000_000;

const certs = (d: Deps): CertRepo => {
  if (!d.certs) throw new Error("certs repository missing");
  return d.certs;
};

export const verifyUrl = (d: Deps, code: string) => `${d.config.siteUrl}/verification/${code}`;
const pdfPath = (code: string) => `${code}.pdf`;
const toB64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Crée l'attestation « eligible » d'un présent (numéro public unique, nouveau tirage en cas de collision). */
async function ensureEligible(d: Deps, registrationId: string, fullName: string): Promise<CertificateRecord> {
  const repo = certs(d);
  const existing = await repo.certificateByRegistration(registrationId);
  if (existing) return existing;
  for (let i = 0; i < 5; i++) {
    const created = await repo.insertCertificate({
      registrationId,
      holderName: fullName,
      publicCode: generatePublicCode(d.event.attestation.codePrefix),
    });
    if (created) return created;
  }
  throw new Error("public code collision");
}

/** Applique une présence et met l'éligibilité en cohérence. Renvoie un avertissement éventuel. */
async function applyAttendance(
  d: Deps,
  admin: string,
  reg: { id: string; full_name: string },
  status: "present" | "absent",
  minutes: number | null,
  source: "manual" | "csv",
): Promise<string | null> {
  const repo = certs(d);
  await repo.setAttendance({ registrationId: reg.id, status, minutes, source, validatedBy: admin });
  const cert = await repo.certificateByRegistration(reg.id);
  if (status === "present") {
    await ensureEligible(d, reg.id, reg.full_name);
    return null;
  }
  if (cert?.status === "eligible") {
    await repo.deleteCertificate(cert.id);
    return null;
  }
  if (cert && (cert.status === "issued" || cert.status === "sent"))
    return "Une attestation a déjà été émise pour cette personne : révoquez-la si elle ne doit plus être valable.";
  return null;
}

/* ------------------------------------------------------------------------ */

export async function handleAdminAttendance(req: Request, d: Deps): Promise<Response> {
  const { cors, early } = preflight(req, d);
  if (early) return early;
  try {
    const admin = await requireAdmin(req, d, cors);
    if (admin instanceof Response) return admin;
    const body = await readJson(req, IMPORT_MAX_BYTES);
    if (!body) return json({ status: "bad_request" }, 400, cors);
    const repo = certs(d);
    const threshold = d.config.attendanceMinMinutes;

    if (body.action === "set") {
      const ids = Array.isArray(body.registration_ids) ? body.registration_ids : [body.registration_id];
      const status = body.status;
      const minutes = typeof body.minutes === "number" && body.minutes >= 0 ? Math.round(body.minutes) : null;
      if (status !== "present" && status !== "absent") return json({ status: "bad_request" }, 400, cors);
      if (!ids.length || ids.length > 500 || !ids.every((x) => typeof x === "string" && UUID_RE.test(x)))
        return json({ status: "bad_request" }, 400, cors);
      const warnings: { registration_id: string; message: string }[] = [];
      for (const id of ids as string[]) {
        const reg = await repo.getRegistration(id);
        if (!reg || reg.event_id !== d.event.id) return json({ status: "not_found", registration_id: id }, 404, cors);
        const w = await applyAttendance(d, admin, reg, status, minutes, "manual");
        if (w) warnings.push({ registration_id: id, message: w });
      }
      await repo.audit("attendance.set", admin, ids.length === 1 ? (ids[0] as string) : null, { status, minutes, count: ids.length });
      return json({ status: "done", updated: ids.length, warnings }, 200, cors);
    }

    if (body.action === "analyze" || body.action === "import") {
      if (!Array.isArray(body.rows) || body.rows.length > 10_000) return json({ status: "bad_request" }, 400, cors);
      const rows: ImportRow[] = body.rows.map((r: unknown) => {
        const o = (r ?? {}) as Record<string, unknown>;
        return {
          email: typeof o.email === "string" ? o.email : "",
          name: typeof o.name === "string" ? o.name.slice(0, 160) : "",
          minutes: typeof o.minutes === "number" && Number.isFinite(o.minutes) ? Math.max(0, Math.round(o.minutes)) : null,
        };
      });
      const regs = (await repo.listRegistrations(d.event.id)).filter((r) => r.status !== "cancelled");
      const analysis = analyzeAttendance(rows, regs, threshold);
      if (body.action === "analyze") return json({ status: "preview", ...analysis }, 200, cors);

      // Import : seules les lignes au-dessus du seuil sont validées ; les autres restent à arbitrer.
      const ok = analysis.matched.filter((m) => m.meetsThreshold);
      for (const m of ok) await applyAttendance(d, admin, { id: m.registrationId, full_name: m.registeredName }, "present", m.minutes, "csv");
      await repo.audit("attendance.import", admin, null, {
        rows: rows.length,
        validated: ok.length,
        below_threshold: analysis.matched.length - ok.length,
        unmatched: analysis.unmatched.length,
        duplicates: analysis.duplicates.length,
        threshold,
      });
      return json({ status: "done", validated: ok.length, ...analysis }, 200, cors);
    }

    return json({ status: "bad_request" }, 400, cors);
  } catch (err) {
    logError("admin-attendance", err);
    return json({ status: "temporary_error" }, 500, cors);
  }
}

/* ------------------------------------------------------------------------ */

async function renderAndStore(d: Deps, cert: CertificateRecord, holderName: string, issuedAt: Date, overwrite: boolean) {
  const cfg = await currentEvent(d);
  const eventDate = cert.event_date ?? cfg.date;
  const { bytes } = await buildCertificatePdf({
    cfg: { ...cfg, date: eventDate },
    holderName,
    code: cert.public_code,
    issuedAt,
    verifyUrl: verifyUrl(d, cert.public_code),
  });
  await certs(d).putPdf(pdfPath(cert.public_code), bytes, overwrite);
  return { path: pdfPath(cert.public_code), eventDate };
}

async function sendCertificate(d: Deps, cert: CertificateRecord, idempotencyKey: string) {
  const repo = certs(d);
  const reg = await repo.getRegistration(cert.registration_id);
  if (!reg || !cert.file_path) return { ok: false as const, code: "missing_data" };
  const cfg = await currentEvent(d);
  const pdf = await repo.getPdf(cert.file_path);
  const email = certificateEmail({
    cfg,
    fullName: cert.holder_name,
    code: cert.public_code,
    eventDate: formatEventDate({ ...cfg, date: cert.event_date ?? cfg.date }) ?? "",
    verifyUrl: verifyUrl(d, cert.public_code),
    siteUrl: d.config.siteUrl,
  });
  const logId = await d.repo.startEmailLog({ registrationId: reg.id, type: "certificate", reference: cert.public_code });
  const result = await d.mailer.send({
    to: reg.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey,
    tags: [{ name: "type", value: "certificate" }],
    attachments: [{ filename: `attestation-${cert.public_code}.pdf`, content: toB64(pdf) }],
  });
  await d.repo.finishEmailLog(logId, result.ok ? { status: "sent", providerMessageId: result.id } : { status: "failed", errorCode: result.code });
  return result;
}

export async function handleAdminCertificates(req: Request, d: Deps): Promise<Response> {
  const { cors, early } = preflight(req, d);
  if (early) return early;
  try {
    const admin = await requireAdmin(req, d, cors);
    if (admin instanceof Response) return admin;
    const body = (await readJson(req)) ?? {};
    const repo = certs(d);
    const limit = Math.min(Math.max(Number(body.limit) || BATCH_MAX, 1), BATCH_MAX);
    const action = body.action;

    if (action === "generate") {
      const cfg = await currentEvent(d);
      if (!cfg.date) return json({ status: "missing_date" }, 409, cors);
      const batch = await repo.listCertificates("eligible", Math.min(limit, GENERATE_MAX));
      const failed: { id: string; error: string }[] = [];
      let generated = 0;
      for (const cert of batch) {
        // Une présence retirée entre-temps n'ouvre plus droit à l'attestation.
        if ((await repo.getAttendanceStatus(cert.registration_id)) !== "present") {
          await repo.deleteCertificate(cert.id);
          continue;
        }
        try {
          const issuedAt = now(d);
          const { path, eventDate } = await renderAndStore(d, cert, cert.holder_name, issuedAt, false);
          await repo.updateCertificate(cert.id, { status: "issued", file_path: path, issued_at: issuedAt.toISOString(), event_date: eventDate });
          generated++;
        } catch (err) {
          logError("certificate.generate", err);
          failed.push({ id: cert.id, error: "generation_failed" });
        }
      }
      if (generated) await repo.audit("certificate.generate", admin, null, { generated, failed: failed.length });
      return json({ status: "done", generated, failed, remaining: await repo.countCertificates("eligible") }, 200, cors);
    }

    if (action === "send") {
      const batch = await repo.listCertificates("issued", limit);
      let sent = 0;
      const failed: { id: string; error: string }[] = [];
      for (const cert of batch) {
        // Une clé par attestation : un lot rejoué n'envoie jamais deux fois le même message.
        const result = await sendCertificate(d, cert, `certificate:${cert.id}:${cert.issued_at}`);
        if (result.ok) {
          await repo.updateCertificate(cert.id, { status: "sent", sent_at: now(d).toISOString(), send_attempts: cert.send_attempts + 1, last_error: null });
          sent++;
        } else {
          await repo.updateCertificate(cert.id, { send_attempts: cert.send_attempts + 1, last_error: result.code });
          failed.push({ id: cert.id, error: result.code });
        }
      }
      if (batch.length) await repo.audit("certificate.send", admin, null, { sent, failed: failed.length });
      return json({ status: failed.length ? "partial" : "done", sent, failed, remaining: await repo.countCertificates("issued") }, 200, cors);
    }

    // Actions sur une attestation précise.
    const id = typeof body.id === "string" ? body.id : "";
    if (!UUID_RE.test(id)) return json({ status: "bad_request" }, 400, cors);
    const cert = await repo.certificateById(id);
    if (!cert) return json({ status: "not_found" }, 404, cors);

    if (action === "resend") {
      if (cert.status !== "sent" && cert.status !== "issued") return json({ status: "not_sendable", certificate_status: cert.status }, 409, cors);
      const minute = Math.floor(now(d).getTime() / 60000);
      const result = await sendCertificate(d, cert, `certificate-resend:${cert.id}:${minute}`);
      if (!result.ok) {
        await repo.updateCertificate(cert.id, { send_attempts: cert.send_attempts + 1, last_error: result.code });
        return json({ status: "email_failed", error_code: result.code }, 502, cors);
      }
      await repo.updateCertificate(cert.id, { status: "sent", sent_at: now(d).toISOString(), send_attempts: cert.send_attempts + 1, last_error: null });
      await repo.audit("certificate.resend", admin, cert.public_code, {});
      return json({ status: "email_sent" }, 200, cors);
    }

    if (action === "revoke") {
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
      if (reason.length < 3) return json({ status: "reason_required" }, 422, cors);
      if (cert.status === "revoked") return json({ status: "already_revoked" }, 409, cors);
      await repo.updateCertificate(cert.id, { status: "revoked", revoked_reason: reason });
      await repo.audit("certificate.revoke", admin, cert.public_code, { reason, previous_status: cert.status });
      return json({ status: "revoked" }, 200, cors);
    }

    if (action === "rename") {
      const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim() : "";
      if (name.length < 3 || name.length > 120) return json({ status: "invalid_name" }, 422, cors);
      if (cert.status === "revoked") return json({ status: "revoked" }, 409, cors);
      const previous = cert.holder_name;
      const regenerated = Boolean(cert.file_path && cert.issued_at);
      // Seule exception à la non-régénération : même numéro, même date d'émission, nom corrigé.
      if (regenerated) await renderAndStore(d, cert, name, new Date(cert.issued_at!), true);
      await repo.updateCertificate(cert.id, { holder_name: name });
      await repo.audit("certificate.rename", admin, cert.public_code, { from: previous, to: name, regenerated });
      return json({ status: "renamed", regenerated }, 200, cors);
    }

    if (action === "download") {
      if (!cert.file_path) return json({ status: "not_generated" }, 409, cors);
      return json({ status: "ok", url: await repo.signedUrl(cert.file_path, 120) }, 200, cors);
    }

    return json({ status: "bad_request" }, 400, cors);
  } catch (err) {
    logError("admin-certificates", err);
    return json({ status: "temporary_error" }, 500, cors);
  }
}

