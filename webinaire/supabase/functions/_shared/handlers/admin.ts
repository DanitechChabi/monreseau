import { rateKey, sha256Hex, timingSafeEqual } from "../crypto.ts";
import { adminLoginEmail, eventDetailsEmail } from "../email/templates.ts";
import { bearerToken, clientIp, corsHeaders, json, readJson } from "../http.ts";
import type { OutgoingEmail } from "../mailer.ts";
import { emailError, normalizeEmail } from "../validation.ts";
import { type Deps, currentEvent, issueAndSendConfirmation, logError, now, sendEventDetails, sendTracked } from "./common.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vérification serveur : JWT Supabase valide ET adresse présente dans `admins`. */
async function requireAdmin(req: Request, d: Deps, cors: Record<string, string>): Promise<Response | string> {
  const token = bearerToken(req);
  const email = token ? await d.repo.emailFromAccessToken(token) : null;
  if (!email) return json({ status: "unauthorized" }, 401, cors);
  if (!(await d.repo.isAdmin(normalizeEmail(email)))) return json({ status: "forbidden" }, 403, cors);
  return email;
}

function preflight(req: Request, d: Deps) {
  const cors = corsHeaders(req, d.config);
  if (req.method === "OPTIONS") return { cors, early: new Response(null, { status: 204, headers: cors }) };
  if (req.method !== "POST") return { cors, early: json({ status: "method_not_allowed" }, 405, cors) };
  return { cors, early: null };
}

/**
 * POST /admin-login { email } — envoie un lien magique aux seules adresses de
 * la table `admins`. Réponse toujours neutre.
 */
export async function handleAdminLogin(req: Request, d: Deps): Promise<Response> {
  const { cors, early } = preflight(req, d);
  if (early) return early;
  const neutral = json(
    { status: "neutral", message: "Si cette adresse est autorisée, un lien de connexion vient d'être envoyé." },
    200,
    cors,
  );
  try {
    const body = await readJson(req);
    const email = normalizeEmail(body?.email);
    if (emailError(email)) return json({ status: "validation_error" }, 422, cors);

    const ipKey = await rateKey(d.config.serviceRoleKey, "ip", clientIp(req));
    if (!(await d.repo.rateLimitHit(ipKey, "admin_login_ip", 3600, 10))) return json({ status: "rate_limited" }, 429, cors);
    const emailKey = await rateKey(d.config.serviceRoleKey, "email", email);
    if (!(await d.repo.rateLimitHit(emailKey, "admin_login_email", 600, 3))) return neutral;

    if (await d.repo.isAdmin(email)) {
      const loginUrl = await d.repo.createMagicLink(email, `${d.config.siteUrl}/admin`);
      await sendTracked(d, {
        registrationId: null,
        type: "admin_login",
        to: email,
        email: adminLoginEmail({ cfg: d.event, loginUrl, siteUrl: d.config.siteUrl }),
        idempotencyKey: `admin-login:${emailKey.slice(0, 16)}:${Math.floor(now(d).getTime() / 60000)}`,
      });
    }
    return neutral;
  } catch (err) {
    logError("admin-login", err);
    return json({ status: "temporary_error" }, 500, cors);
  }
}

/**
 * POST /admin-resend { registration_id } — réservé aux administrateurs.
 * Inscription en attente → nouvel e-mail de confirmation ;
 * inscription confirmée → e-mail d'informations pratiques.
 */
export async function handleAdminResend(req: Request, d: Deps): Promise<Response> {
  const { cors, early } = preflight(req, d);
  if (early) return early;
  try {
    const admin = await requireAdmin(req, d, cors);
    if (admin instanceof Response) return admin;

    const body = await readJson(req);
    const id = typeof body?.registration_id === "string" ? body.registration_id : "";
    if (!UUID_RE.test(id)) return json({ status: "bad_request" }, 400, cors);
    const registration = await d.repo.findRegistrationById(id);
    if (!registration || registration.event_id !== d.event.id) return json({ status: "not_found" }, 404, cors);
    if (registration.status === "cancelled") return json({ status: "cancelled" }, 409, cors);

    // Même minute = même clé : un double clic n'envoie qu'un message.
    const minute = Math.floor(now(d).getTime() / 60000);
    const result =
      registration.status === "pending_confirmation"
        ? await issueAndSendConfirmation(d, registration, `admin-resend-${minute}`)
        : await sendEventDetails(d, registration, `admin-details:${registration.id}:${minute}`, null);
    const type = registration.status === "pending_confirmation" ? "confirmation" : "event_details";
    return result.ok
      ? json({ status: "email_sent", type }, 200, cors)
      : json({ status: "email_failed", type, error_code: result.code }, 502, cors);
  } catch (err) {
    logError("admin-resend", err);
    return json({ status: "temporary_error" }, 500, cors);
  }
}

/**
 * POST /admin-announce { dry_run?: boolean } — envoie la date, l'heure et le
 * lien aux inscrits confirmés. Chaque version des réglages n'est envoyée
 * qu'une fois par personne (référence = empreinte des réglages).
 */
export async function handleAdminAnnounce(req: Request, d: Deps): Promise<Response> {
  const { cors, early } = preflight(req, d);
  if (early) return early;
  try {
    const admin = await requireAdmin(req, d, cors);
    if (admin instanceof Response) return admin;
    const body = (await readJson(req)) ?? {};

    const cfg = await currentEvent(d);
    if (!cfg.date || !cfg.time) return json({ status: "missing_date" }, 409, cors);
    const reference = (await sha256Hex([cfg.date, cfg.time, cfg.joinUrl ?? "", cfg.qaDurationMinutes ?? ""].join("|"))).slice(0, 16);
    const recipients = await d.repo.listConfirmedMissingEmail(d.event.id, "event_details", reference);
    if (body.dry_run === true) return json({ status: "preview", count: recipients.length, reference }, 200, cors);

    let sent = 0;
    let failed = 0;
    const sleep = d.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    for (let i = 0; i < recipients.length; i += 100) {
      const chunk = recipients.slice(i, i + 100);
      const logIds = await Promise.all(
        chunk.map((r) => d.repo.startEmailLog({ registrationId: r.id, type: "event_details", reference })),
      );
      const emails: OutgoingEmail[] = chunk.map((r) => {
        const e = eventDetailsEmail({ cfg, fullName: r.full_name, siteUrl: d.config.siteUrl });
        return { to: r.email, ...e, idempotencyKey: `announce:${reference}:${r.id}`, tags: [{ name: "type", value: "event_details" }] };
      });
      const result = await d.mailer.sendBatch(emails, `announce:${reference}:${chunk[0]!.id}:${chunk.length}`);
      await Promise.all(
        logIds.map((logId, n) =>
          d.repo.finishEmailLog(
            logId,
            result.ok ? { status: "sent", providerMessageId: result.ids[n] ?? null } : { status: "failed", errorCode: result.code },
          ),
        ),
      );
      if (result.ok) sent += chunk.length;
      else failed += chunk.length;
      if (i + 100 < recipients.length) await sleep(600); // limite de débit Resend
    }
    return json({ status: "done", sent, failed, reference }, failed ? 502 : 200, cors);
  } catch (err) {
    logError("admin-announce", err);
    return json({ status: "temporary_error" }, 500, cors);
  }
}

/** POST /purge-expired — appelé par une tâche planifiée avec la clé service_role. */
export async function handlePurgeExpired(req: Request, d: Deps): Promise<Response> {
  if (req.method !== "POST") return json({ status: "method_not_allowed" }, 405);
  const token = bearerToken(req) ?? "";
  if (!timingSafeEqual(token, d.config.serviceRoleKey)) return json({ status: "unauthorized" }, 401);
  try {
    const deleted = await d.repo.purgeExpired(d.config.dataRetentionMonths);
    return json({ status: "done", deleted, retention_months: d.config.dataRetentionMonths }, 200);
  } catch (err) {
    logError("purge-expired", err);
    return json({ status: "temporary_error" }, 500);
  }
}
