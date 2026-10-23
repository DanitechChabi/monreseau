import { sha256Hex, TOKEN_RE } from "../crypto.ts";
import { type Deps, logError } from "./common.ts";

const STATE = { ok: "ok", expired: "expire", invalid: "invalide" } as const;

/**
 * GET /confirm?token=… → redirection vers /confirmation?etat=ok|expire|invalide
 * (ou « erreur » en cas d'incident temporaire).
 * HEAD ne consomme pas le jeton (pré-chargements de certains antivirus).
 */
export async function handleConfirm(req: Request, d: Deps): Promise<Response> {
  if (req.method === "HEAD") return new Response(null, { status: 200 });
  const redirect = (etat: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: `${d.config.siteUrl}/confirmation?etat=${etat}`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  if (req.method !== "GET") return new Response(null, { status: 405 });

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!TOKEN_RE.test(token)) return redirect(STATE.invalid);
  try {
    const result = await d.repo.confirmToken(await sha256Hex(token));
    return redirect(STATE[result]);
  } catch (err) {
    logError("confirm", err);
    return redirect("erreur");
  }
}
