import type { NameFormat } from "../event.ts";

/** Alphabet sans caractères ambigus (0/O, 1/I/L). */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_RE = /^[A-Z]{2,5}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

/** Numéro public aléatoire et non séquentiel, ex. AXD-7K2P-9QWM (≈ 40 bits d'aléa). */
export function generatePublicCode(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]);
  return `${prefix}-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

const isUpperWord = (w: string) => w.length > 1 && w === w.toLocaleUpperCase("fr") && w !== w.toLocaleLowerCase("fr");
const cap = (w: string) => w.charAt(0).toLocaleUpperCase("fr") + w.slice(1).toLocaleLowerCase("fr");
const initial = (w: string) => `${w.charAt(0).toLocaleUpperCase("fr")}.`;

/**
 * Sépare prénom(s) et nom(s). Convention administrative fréquente au Bénin et
 * au Niger : le NOM en capitales (« CHABI BOUKO Daniel ») ; sinon on considère
 * le premier mot comme prénom (« Awa Diallo »).
 */
export function splitName(full: string): { given: string[]; family: string[] } {
  const words = full.trim().split(/\s+/).filter(Boolean);
  const upper = words.filter(isUpperWord);
  if (upper.length > 0 && upper.length < words.length) {
    return { given: words.filter((w) => !isUpperWord(w)), family: upper };
  }
  return { given: words.slice(0, 1), family: words.slice(1) };
}

/** Nom affiché sur la page publique de vérification (jamais d'autres données). */
export function formatHolderName(full: string, format: NameFormat): string {
  const { given, family } = splitName(full);
  if (format === "full") return [...given.map(cap), ...family.map((w) => w.toLocaleUpperCase("fr"))].join(" ");
  if (format === "initials") return [...given, ...family].map(initial).join(" ");
  return [...given.map(cap), ...family.map(initial)].join(" ");
}
