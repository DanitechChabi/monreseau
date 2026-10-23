// Assemblage des dépendances pour l'exécution Deno (Supabase Edge Functions).
import { loadConfig } from "./config.ts";
import { event } from "./event.ts";
import type { Deps } from "./handlers/common.ts";
import { ResendMailer } from "./mailer.ts";
import { SupabaseCertRepo, SupabaseRepo } from "./supabase-repo.ts";

export function createDeps(): Deps {
  const config = loadConfig((name) => Deno.env.get(name));
  return {
    config,
    event,
    repo: new SupabaseRepo(config.supabaseUrl, config.serviceRoleKey),
    certs: new SupabaseCertRepo(config.supabaseUrl, config.serviceRoleKey, config.attestationBucket),
    mailer: new ResendMailer({ apiKey: config.resendApiKey, from: config.emailFrom, replyTo: config.emailReplyTo }),
  };
}
