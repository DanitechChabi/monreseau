/**
 * Configuration centrale du webinaire.
 *
 * Règle : toute valeur non confirmée reste à `null`. La page n'affiche jamais
 * une valeur nulle — pas de date, pas d'heure, pas de compte à rebours, pas de
 * contact tant que l'information n'est pas renseignée ici.
 */

export type Organizer = {
  name: string;
  country: string;
  /** Chemin public du logo, ex. "/logos/archivexa.svg". `null` → nom affiché en texte. */
  logo: string | null;
};

export type Speaker = {
  id: string;
  name: string;
  /** Chemin public d'un portrait réel. `null` → initiales. */
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
  /** Point d'API d'inscription — branché en passe 2. Tant qu'il est `null`, aucune donnée n'est envoyée. */
  registrationEndpoint: string | null;
  organizers: Organizer[];
  speakers: Speaker[];
  programme: ProgrammeItem[];
};

export const event: EventConfig = {
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
  registrationEndpoint: null,
  organizers: [
    // Déposer les fichiers dans public/logos/ puis renseigner le chemin.
    { name: "Archivexa", country: "Bénin", logo: null },
    { name: "Docflow", country: "Niger", logo: null },
  ],
  speakers: [
    { id: "ousmane", name: "Ousmane Abdou", portrait: null },
    { id: "roguy", name: "Roguy", portrait: null },
    { id: "daniel", name: "Daniel", portrait: null },
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
