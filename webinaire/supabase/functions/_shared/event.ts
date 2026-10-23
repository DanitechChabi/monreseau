/**
 * Configuration centrale du webinaire, partagée par le site (Vite) et les
 * Edge Functions (Deno) : ce fichier ne doit importer aucun module.
 *
 * Règle : toute valeur non confirmée reste à `null`. La page n'affiche jamais
 * une valeur nulle — pas de date, pas d'heure, pas de compte à rebours, pas de
 * contact tant que l'information n'est pas renseignée.
 *
 * Date, heure, durée des questions-réponses, lien de participation et contact
 * se règlent depuis /admin (table `event_settings`) : les valeurs en base
 * remplacent celles d'ici (voir `withSettings`).
 */

export type Organizer = {
  name: string;
  country: string;
  /** Logo fourni par l'organisation (dans public/logos/). `null` → nom affiché en texte. */
  logo: {
    src: string;
    width: number;
    height: number;
    /** Le logo contient déjà le nom écrit : on ne le répète pas à côté. */
    includesName: boolean;
  } | null;
};

export type Speaker = {
  id: string;
  name: string;
  /** Chemin public d'un portrait réel (carré, dans public/speakers/). `null` → initiales. */
  portrait: string | null;
};

export type ProgrammeTalk = {
  kind: "talk";
  speakerId: string;
  title: string;
  topics: string[];
  /** Durée indicative en minutes. */
  durationMinutes: number | null;
};

export type ProgrammeQA = {
  kind: "qa";
  title: string;
};

export type ProgrammeItem = ProgrammeTalk | ProgrammeQA;

export type EventTimezone = { label: string; timeZone: string };

export type EventConfig = {
  /** Identifiant de l'événement en base (colonne `event_id`). */
  id: string;
  title: string;
  tagline: string;
  /** Format AAAA-MM-JJ, ex. "2026-11-27". */
  date: string | null;
  /** Format HH:MM (24 h), heure locale du fuseau de référence. */
  time: string | null;
  /** Fuseau dans lequel `date` et `time` sont exprimées. */
  referenceTimeZone: string;
  timeZones: EventTimezone[];
  /** Durée des questions-réponses en minutes. */
  qaDurationMinutes: number | null;
  /** Lien de connexion, envoyé par e-mail aux inscrits (non affiché publiquement). */
  joinUrl: string | null;
  contactEmail: string | null;
  privacy: {
    /** Durée de conservation des inscriptions, en mois (garder égal à DATA_RETENTION_MONTHS). */
    retentionMonths: number;
  };
  organizers: Organizer[];
  speakers: Speaker[];
  programme: ProgrammeItem[];
};

export const event: EventConfig = {
  id: "maitrise-information-2026",
  title: "Reprenez le contrôle de votre information",
  tagline: "Regards croisés Niger · Bénin",
  date: null,
  time: null,
  referenceTimeZone: "Africa/Porto-Novo",
  timeZones: [
    { label: "Bénin", timeZone: "Africa/Porto-Novo" },
    { label: "Niger", timeZone: "Africa/Niamey" },
  ],
  qaDurationMinutes: null,
  joinUrl: null,
  contactEmail: null,
  privacy: { retentionMonths: 12 },
  organizers: [
    // Déposer les fichiers dans public/logos/ puis renseigner le chemin et les dimensions (px).
    {
      name: "Archivexa",
      country: "Bénin",
      logo: { src: "/logos/archivexa.png", width: 256, height: 256, includesName: false },
    },
    {
      name: "Docflow",
      country: "Niger",
      logo: { src: "/logos/docflow.png", width: 256, height: 256, includesName: false },
    },
    {
      name: "RMBI",
      country: "Bénin",
      logo: { src: "/logos/rmbi.png", width: 194, height: 64, includesName: true },
    },
  ],
  speakers: [
    { id: "ousmane", name: "Ousmane Abdou", portrait: "/speakers/ousmane-abdou.jpg" },
    { id: "roguy", name: "Roguy Abadassi", portrait: "/speakers/roguy.jpg" },
    { id: "daniel", name: "Daniel Chabi Bouko", portrait: "/speakers/daniel.jpg" },
  ],
  programme: [
    {
      kind: "talk",
      speakerId: "ousmane",
      title: "Le diagnostic",
      topics: [
        "État des lieux de la gestion documentaire",
        "Archives physiques et numériques désorganisées",
        "Documents introuvables et fichiers dispersés",
        "Causes et conséquences",
      ],
      durationMinutes: 20,
    },
    {
      kind: "talk",
      speakerId: "roguy",
      title: "Les fondamentaux pour reprendre le contrôle",
      topics: [
        "Plan de classement",
        "Cycle de vie du document",
        "Calendrier de conservation",
        "Tri et conditions de stockage",
        "Complémentarité physique et numérique",
      ],
      durationMinutes: 20,
    },
    {
      kind: "talk",
      speakerId: "daniel",
      title: "Le numérique comme levier",
      topics: [
        "Numérisation",
        "GED",
        "Nommage et métadonnées",
        "Sécurité et sauvegarde",
        "Feuille de route et premières actions",
      ],
      durationMinutes: 20,
    },
    { kind: "qa", title: "Échanges et questions-réponses" },
  ],
};

/** Réglages modifiables depuis /admin (table `event_settings`). `null` = non renseigné. */
export type EventSettings = {
  date: string | null;
  time: string | null;
  qaDurationMinutes: number | null;
  joinUrl: string | null;
  contactEmail: string | null;
};

export const EMPTY_SETTINGS: EventSettings = {
  date: null,
  time: null,
  qaDurationMinutes: null,
  joinUrl: null,
  contactEmail: null,
};

/** Applique les réglages enregistrés en base par-dessus la configuration statique. */
export function withSettings(base: EventConfig, settings: Partial<EventSettings> | null | undefined): EventConfig {
  if (!settings) return base;
  return {
    ...base,
    date: settings.date ?? base.date,
    time: settings.time ? settings.time.slice(0, 5) : base.time,
    qaDurationMinutes: settings.qaDurationMinutes ?? base.qaDurationMinutes,
    joinUrl: settings.joinUrl ?? base.joinUrl,
    contactEmail: settings.contactEmail ?? base.contactEmail,
  };
}

/** « Archivexa, Docflow et RMBI » */
export function organizerNames(cfg: EventConfig): string {
  const names = cfg.organizers.map((o) => o.name);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : (names[0] ?? "");
}
