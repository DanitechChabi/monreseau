/**
 * Validation et normalisation des inscriptions — partagée par le formulaire
 * (messages affichés) et la fonction `register` (contrôle faisant foi).
 */

export const COUNTRIES = ["BJ", "NE", "other"] as const;
export type Country = (typeof COUNTRIES)[number];

export type RegistrationInput = {
  full_name: string;
  email: string;
  organisation: string;
  job_title: string;
  country: Country;
  phone: string | null;
  marketing_consent: boolean;
};

export type RegistrationField = "full_name" | "email" | "organisation" | "job_title" | "country" | "phone";
export type FieldErrors = Partial<Record<RegistrationField, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[\d\s().-]+$/;

const collapse = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** E-mail normalisé : espaces retirés, adresse entière en minuscules. */
export function normalizeEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

export function emailError(email: string): string | undefined {
  if (!email) return "Veuillez indiquer votre adresse e-mail.";
  if (email.length > 254 || !EMAIL_RE.test(email))
    return "Cette adresse e-mail ne semble pas valide (exemple : nom@organisation.org).";
  return undefined;
}

export function validateRegistration(
  raw: Record<string, unknown>,
): { ok: true; value: RegistrationInput } | { ok: false; errors: FieldErrors } {
  const full_name = collapse(raw.full_name);
  const email = normalizeEmail(raw.email);
  const organisation = collapse(raw.organisation);
  const job_title = collapse(raw.job_title);
  const country = typeof raw.country === "string" ? raw.country : "";
  const phone = collapse(raw.phone);
  const errors: FieldErrors = {};

  if (!full_name) errors.full_name = "Veuillez indiquer votre nom et votre prénom.";
  else if (full_name.length < 3 || !full_name.includes(" "))
    errors.full_name = "Indiquez votre nom et votre prénom, séparés par un espace.";
  else if (full_name.length > 120) errors.full_name = "Ce nom est trop long (120 caractères au maximum).";

  const mailErr = emailError(email);
  if (mailErr) errors.email = mailErr;

  if (!organisation) errors.organisation = "Veuillez indiquer votre organisation.";
  else if (organisation.length > 160) errors.organisation = "Ce nom d'organisation est trop long (160 caractères au maximum).";

  if (!job_title) errors.job_title = "Veuillez indiquer votre fonction.";
  else if (job_title.length > 120) errors.job_title = "Cet intitulé est trop long (120 caractères au maximum).";

  if (!(COUNTRIES as readonly string[]).includes(country)) errors.country = "Veuillez choisir votre pays.";

  if (phone) {
    const digits = phone.replace(/\D/g, "").length;
    if (!PHONE_RE.test(phone) || digits < 8 || digits > 15 || phone.length > 30)
      errors.phone =
        "Ce numéro ne semble pas valide. Utilisez uniquement des chiffres, éventuellement précédés de l'indicatif (+229, +227…).";
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      full_name,
      email,
      organisation,
      job_title,
      country: country as Country,
      phone: phone || null,
      marketing_consent: raw.marketing_consent === true,
    },
  };
}
