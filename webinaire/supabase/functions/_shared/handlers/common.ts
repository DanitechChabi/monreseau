import type { ServerConfig } from "../config.ts";
import { randomToken, sha256Hex } from "../crypto.ts";
import { confirmationEmail, eventDetailsEmail, type RenderedEmail } from "../email/templates.ts";
import { type EventConfig, withSettings } from "../event.ts";
import type { Mailer, SendResult } from "../mailer.ts";
import type { CertRepo } from "../certificates/repo.ts";
import type { EmailType, RegistrationRecord, Repo } from "../repo.ts";

export type Deps = {
  repo: Repo;
  /** Présences et attestations (fonctions de la passe 3). */
  certs?: CertRepo;
  mailer: Mailer;
  config: ServerConfig;
  /** Contenu statique de l'événement (programme, organisateurs…). */
  event: EventConfig;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
};

export const now = (d: Deps) => (d.now ? d.now() : new Date());

/** Configuration effective : contenu statique + réglages saisis dans /admin. */
export async function currentEvent(d: Deps): Promise<EventConfig> {
  return withSettings(d.event, await d.repo.getEventSettings(d.event.id));
}

/** Journalise l'envoi (pending → sent | failed) sans jamais stocker l'adresse. */
export async function sendTracked(
  d: Deps,
  args: { registrationId: string | null; type: EmailType; reference?: string | null; to: string; email: RenderedEmail; idempotencyKey: string },
): Promise<SendResult> {
  const logId = await d.repo.startEmailLog({ registrationId: args.registrationId, type: args.type, reference: args.reference ?? null });
  const result = await d.mailer.send({
    to: args.to,
    subject: args.email.subject,
    html: args.email.html,
    text: args.email.text,
    idempotencyKey: args.idempotencyKey,
    tags: [{ name: "type", value: args.type }],
  });
  await d.repo.finishEmailLog(
    logId,
    result.ok ? { status: "sent", providerMessageId: result.id } : { status: "failed", errorCode: result.code },
  );
  return result;
}

/** Nouveau jeton (les anciens sont supprimés) puis envoi de l'e-mail de confirmation. */
export async function issueAndSendConfirmation(
  d: Deps,
  registration: RegistrationRecord,
  keyPrefix: string,
): Promise<SendResult> {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(now(d).getTime() + d.config.tokenTtlHours * 3600_000);
  await d.repo.issueConfirmationToken(registration.id, tokenHash, expiresAt);

  const cfg = await currentEvent(d);
  const confirmUrl = `${d.config.supabaseUrl}/functions/v1/confirm?token=${token}`;
  const email = confirmationEmail({
    cfg,
    fullName: registration.full_name,
    confirmUrl,
    siteUrl: d.config.siteUrl,
    ttlHours: d.config.tokenTtlHours,
  });
  return sendTracked(d, {
    registrationId: registration.id,
    type: "confirmation",
    to: registration.email,
    email,
    // Une clé par jeton : un double envoi du même message est ignoré par Resend.
    idempotencyKey: `${keyPrefix}:${registration.id}:${tokenHash.slice(0, 16)}`,
  });
}

export async function sendEventDetails(d: Deps, registration: RegistrationRecord, idempotencyKey: string, reference: string | null) {
  const cfg = await currentEvent(d);
  return sendTracked(d, {
    registrationId: registration.id,
    type: "event_details",
    reference,
    to: registration.email,
    email: eventDetailsEmail({ cfg, fullName: registration.full_name, siteUrl: d.config.siteUrl }),
    idempotencyKey,
  });
}

/** Erreur journalisée sans donnée personnelle (pas de message brut de la base). */
export function logError(scope: string, err: unknown) {
  const code =
    err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : err instanceof Error ? err.name : "unknown";
  console.error(`[${scope}] erreur ${code}`);
}
