/**
 * Recherche de clés secrètes dans un dossier (le build front `dist/`).
 * Détecte : JWT Supabase de rôle service_role, clés secrètes Supabase
 * (sb_secret_…), clés Resend (re_…), et les valeurs exactes des variables
 * secrètes présentes dans l'environnement ou dans les fichiers .env.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

export const SECRET_ENV_NAMES = ["SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY"];

export type Finding = { file: string; reason: string };

function jwtRole(token: string): string | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function scanText(text: string, knownSecrets: string[] = []): string[] {
  const reasons: string[] = [];
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)) {
    if (jwtRole(m[0]) === "service_role") reasons.push("JWT service_role");
  }
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) reasons.push("clé secrète Supabase (sb_secret_)");
  if (/\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/.test(text)) reasons.push("clé API Resend (re_)");
  for (const s of knownSecrets) if (s.length >= 12 && text.includes(s)) reasons.push("valeur d'une variable secrète");
  return reasons;
}

/** Valeurs des variables secrètes connues (environnement + fichiers .env*). */
export function knownSecretValues(root: string): string[] {
  const values = SECRET_ENV_NAMES.map((n) => process.env[n]).filter((v): v is string => Boolean(v));
  for (const f of readdirSync(root)) {
    if (!f.startsWith(".env") || f === ".env.example") continue;
    for (const line of readFileSync(join(root, f), "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"#\s]+)"?/.exec(line);
      if (m && SECRET_ENV_NAMES.includes(m[1]!)) values.push(m[2]!);
    }
  }
  return values;
}

export function scanDir(dir: string, knownSecrets: string[] = []): Finding[] {
  if (!existsSync(dir)) throw new Error(`Dossier introuvable : ${dir} (lancer « npm run build »)`);
  const findings: Finding[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|mjs|css|html|json|map|txt|svg)$/.test(name))
        for (const reason of scanText(readFileSync(p, "utf8"), knownSecrets)) findings.push({ file: p, reason });
    }
  };
  walk(dir);
  return findings;
}
