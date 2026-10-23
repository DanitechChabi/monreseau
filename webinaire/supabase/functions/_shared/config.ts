/** Configuration serveur, lue depuis les secrets des Edge Functions. */
export type ServerConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  resendApiKey: string | null;
  emailFrom: string | null;
  emailReplyTo: string | null;
  /** URL publique du site, sans « / » final (liens des e-mails, redirections). */
  siteUrl: string;
  /** Origines autorisées (CORS). */
  allowedOrigins: string[];
  resendCooldownMinutes: number;
  resendMaxPerEmailPerDay: number;
  resendMaxPerIpPerHour: number;
  registerMaxPerIpPerHour: number;
  tokenTtlHours: number;
  dataRetentionMonths: number;
};

const int = (v: string | undefined, fallback: number, min = 0) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
};

export function loadConfig(env: (name: string) => string | undefined): ServerConfig {
  const required = (name: string) => {
    const v = env(name);
    if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
    return v;
  };
  const siteUrl = required("PUBLIC_SITE_URL").replace(/\/+$/, "");
  const extra = (env("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return {
    supabaseUrl: required("SUPABASE_URL").replace(/\/+$/, ""),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    resendApiKey: env("RESEND_API_KEY") || null,
    emailFrom: env("EMAIL_FROM") || null,
    emailReplyTo: env("EMAIL_REPLY_TO") || null,
    siteUrl,
    allowedOrigins: [new URL(siteUrl).origin, ...extra],
    resendCooldownMinutes: int(env("RESEND_COOLDOWN_MINUTES"), 5, 1),
    resendMaxPerEmailPerDay: int(env("RESEND_MAX_PER_EMAIL_PER_DAY"), 5, 1),
    resendMaxPerIpPerHour: int(env("RESEND_MAX_PER_IP_PER_HOUR"), 20, 1),
    registerMaxPerIpPerHour: int(env("REGISTER_MAX_PER_IP_PER_HOUR"), 10, 1),
    tokenTtlHours: int(env("CONFIRMATION_TOKEN_TTL_HOURS"), 48, 1),
    dataRetentionMonths: int(env("DATA_RETENTION_MONTHS"), 12, 1),
  };
}
