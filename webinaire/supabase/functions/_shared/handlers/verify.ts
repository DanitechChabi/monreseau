/**
 * Fonction publique verify-certificate. Volontairement séparée du générateur PDF
 * (polices et logos intégrés) pour un démarrage rapide.
 */
import { rateKey } from "../crypto.ts";
import { formatEventDate } from "../datetime.ts";
import { clientIp, corsHeaders, json, readJson } from "../http.ts";
import { CODE_RE, formatHolderName } from "../certificates/names.ts";
import { type Deps, currentEvent, logError } from "./common.ts";

/**
 * Vérification publique. Ne renvoie que : numéro, nom abrégé, titre, date,
 * organisateurs et statut. Jamais l'e-mail, le téléphone ni l'organisation.
 */
export async function handleVerifyCertificate(req: Request, d: Deps): Promise<Response> {
  const cors = { ...corsHeaders(req, d.config), "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    const raw = req.method === "GET" ? new URL(req.url).searchParams.get("code") : (await readJson(req))?.code;
    const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    if (!CODE_RE.test(code)) return json({ status: "not_found" }, 404, cors);

    const ipKey = await rateKey(d.config.serviceRoleKey, "ip", clientIp(req));
    if (!(await d.repo.rateLimitHit(ipKey, "verify_ip", 3600, 120))) return json({ status: "rate_limited" }, 429, cors);

    if (!d.certs) throw new Error("certs repository missing");
    const cert = await d.certs.certificateByCode(code);
    if (!cert || cert.status === "eligible") return json({ status: "not_found" }, 404, cors);

    const cfg = await currentEvent(d);
    return json(
      {
        status: cert.status === "revoked" ? "revoked" : "valid",
        code: cert.public_code,
        holder: formatHolderName(cert.holder_name, d.config.attestationNameFormat),
        title: cfg.title,
        date: formatEventDate({ ...cfg, date: cert.event_date }),
        organizers: cfg.organizers.map((o) => ({ name: o.name, country: o.country })),
        issued_at: cert.issued_at ? cert.issued_at.slice(0, 10) : null,
      },
      200,
      { ...cors, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    );
  } catch (err) {
    logError("verify-certificate", err);
    return json({ status: "temporary_error" }, 500, cors);
  }
}
