import { rateKey } from "../crypto.ts";
import { clientIp, corsHeaders, json, readJson } from "../http.ts";
import { validateRegistration } from "../validation.ts";
import { type Deps, issueAndSendConfirmation, logError } from "./common.ts";

/**
 * POST /register
 * Réponses : registered_email_sent (201) · registered_email_pending (201) ·
 * already_registered (200) · validation_error (422) · rate_limited (429) ·
 * temporary_error (500).
 */
export async function handleRegister(req: Request, d: Deps): Promise<Response> {
  const cors = corsHeaders(req, d.config);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ status: "method_not_allowed" }, 405, cors);

  try {
    const body = await readJson(req);
    if (!body) return json({ status: "bad_request" }, 400, cors);

    // Pot de miel : un humain ne remplit jamais ce champ caché. Rien n'est enregistré.
    if (typeof body.website === "string" && body.website.trim() !== "") return json({ status: "accepted" }, 202, cors);

    const ipKey = await rateKey(d.config.serviceRoleKey, "ip", clientIp(req));
    if (!(await d.repo.rateLimitHit(ipKey, "register_ip", 3600, d.config.registerMaxPerIpPerHour)))
      return json({ status: "rate_limited" }, 429, cors);

    const v = validateRegistration(body);
    if (!v.ok) return json({ status: "validation_error", errors: v.errors }, 422, cors);

    const { registration, created } = await d.repo.registerParticipant(d.event.id, v.value);
    if (!created)
      return json({ status: "already_registered", confirmed: registration.status === "confirmed" }, 200, cors);

    const sent = await issueAndSendConfirmation(d, registration, "register");
    if (!sent.ok) return json({ status: "registered_email_pending" }, 201, cors);

    // Démarre le délai minimal avant une demande de renvoi.
    const emailKey = await rateKey(d.config.serviceRoleKey, "email", registration.email);
    await d.repo.rateLimitHit(emailKey, "resend_cooldown", d.config.resendCooldownMinutes * 60, 1);
    return json({ status: "registered_email_sent" }, 201, cors);
  } catch (err) {
    logError("register", err);
    return json({ status: "temporary_error" }, 500, cors);
  }
}
