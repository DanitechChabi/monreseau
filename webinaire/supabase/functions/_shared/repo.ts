import type { EventSettings } from "./event.ts";
import type { RegistrationInput } from "./validation.ts";

export type RegistrationStatus = "pending_confirmation" | "confirmed" | "cancelled";

export type RegistrationRecord = {
  id: string;
  event_id: string;
  full_name: string;
  email: string;
  status: RegistrationStatus;
};

export type EmailType = "confirmation" | "event_details" | "admin_login" | "certificate";
export type ConfirmResult = "ok" | "expired" | "invalid";

/**
 * Accès aux données utilisé par les fonctions. L'implémentation réelle
 * (supabase-repo.ts) passe par la clé service_role ; les tests utilisent une
 * implémentation en mémoire.
 */
export interface Repo {
  /** Compte un appel ; `false` si le plafond de la fenêtre est dépassé. */
  rateLimitHit(key: string, action: string, windowSeconds: number, max: number): Promise<boolean>;
  /** Insère, ou renvoie l'inscription existante (contrainte unique event_id + email). */
  registerParticipant(eventId: string, input: RegistrationInput): Promise<{ registration: RegistrationRecord; created: boolean }>;
  findRegistrationByEmail(eventId: string, email: string): Promise<RegistrationRecord | null>;
  findRegistrationById(id: string): Promise<RegistrationRecord | null>;
  /** Supprime les jetons précédents de l'inscription et enregistre le nouveau hash. */
  issueConfirmationToken(registrationId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  confirmToken(tokenHash: string): Promise<ConfirmResult>;
  /** Crée une ligne « pending » dans email_log avant l'appel au fournisseur. */
  startEmailLog(entry: { registrationId: string | null; type: EmailType; reference?: string | null }): Promise<number>;
  finishEmailLog(id: number, result: { status: "sent" | "failed"; providerMessageId?: string | null; errorCode?: string | null }): Promise<void>;
  getEventSettings(eventId: string): Promise<EventSettings>;
  isAdmin(email: string): Promise<boolean>;
  /** E-mail de l'utilisateur Supabase Auth porteur du JWT, ou `null`. */
  emailFromAccessToken(accessToken: string): Promise<string | null>;
  /** Crée le compte si besoin et renvoie un lien magique de connexion. */
  createMagicLink(email: string, redirectTo: string): Promise<string>;
  /** Inscrits confirmés n'ayant pas encore reçu (avec succès) l'e-mail `reference`. */
  listConfirmedMissingEmail(eventId: string, type: EmailType, reference: string): Promise<RegistrationRecord[]>;
  purgeExpired(months: number): Promise<number>;
}
