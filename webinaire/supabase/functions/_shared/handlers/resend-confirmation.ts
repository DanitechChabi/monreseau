import { rateKey } from "../crypto.ts";
import { clientIp, corsHeaders, json, readJson } from "../http.ts";
import { emailError, normalizeEmail } from "../validation.ts";
import { type Deps, issueAndSendConfirmation, logError } from "./common.ts";

export const NEUTRAL_MESSAGE = "Si cette adresse est inscrite, un e-mail vient d'être envoyé.";

/**
 * POST /resend-confirmation { email }
 * La réponse ne révèle jamais si l'adresse est inscrite : les délais et
 * plafonds s'appliquent à toute adresse, inscrite ou non.
 */
export async function handleResendConfirmation(req: Request, d: Deps): Promise<Response> {
  const cors = corsHeaders(req, d.config);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ status: "method_not_allowed" }, 405, cors);

  try {
    const body = await readJson(req);
    if (!body) return json({ status: "bad_request" }, 400, cors);
    if (typeof body.website === "string" && body.website.trim() !== "")
      return json({ status: "neutral", message: NEUTRAL_MESSAGE }, 200, cors);

    const email = normalizeEmail(body.email);
    const err = emailError(email);
    if (err) return json({ status: "validation_error", errors: { email: err } }, 422, cors);

    const secret = d.config.serviceRoleKey;
    const ipKey = await rateKey(secret, "ip", clientIp(req));
    if (!(await d.repo.rateLimitHit(ipKey, "resend_ip", 3600, d.config.resendMaxPerIpPerHour)))
      return json({ status: "rate_limited" }, 429, cors);

    const emailKey = await rateKey(secret, "email", email);
    if (!(await d.repo.rateLimitHit(emailKey, "resend_cooldown", d.config.resendCooldownMinutes * 60, 1)))
      return json({ status: "cooldown", retry_after_minutes: d.config.resendCooldownMinutes }, 429, cors);
    if (!(await d.repo.rateLimitHit(emailKey, "resend_daily", 86400, d.config.resendMaxPerEmailPerDay)))
      return json({ status: "rate_limited" }, 429, cors);

    const registration = await d.repo.findRegistrationByEmail(d.event.id, email);
    if (registration?.status === "pending_confirmation") {
      // Le résultat de l'envoi n'est pas exposé (réponse neutre) ; il est visible dans /admin.
      await issueAndSendConfirmation(d, registration, "resend");
    }
    return json({ status: "neutral", message: NEUTRAL_MESSAGE }, 200, cors);
  } catch (err) {
    logError("resend-confirmation", err);
    return json({ status: "temporary_error" }, 500, cors);
  }
}
