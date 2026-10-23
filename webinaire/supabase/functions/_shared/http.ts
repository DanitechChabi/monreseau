import type { ServerConfig } from "./config.ts";

export const MAX_BODY_BYTES = 10_000;

export function corsHeaders(req: Request, cfg: Pick<ServerConfig, "allowedOrigins">): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = origin && cfg.allowedOrigins.includes(origin) ? origin : cfg.allowedOrigins[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

/** Première adresse de X-Forwarded-For (posée par la passerelle Supabase). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Lit un corps JSON objet, en refusant les corps trop gros. `null` si invalide. */
export async function readJson(req: Request, maxBytes = MAX_BODY_BYTES): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    const data: unknown = JSON.parse(text);
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim() || null;
}
