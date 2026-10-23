/**
 * Import des présences depuis l'export CSV d'une visioconférence (Zoom, Google
 * Meet, Microsoft Teams). Partagé par l'administration (aperçu) et la fonction
 * admin-attendance (rapprochement faisant foi).
 */
import { normalizeEmail } from "../validation.ts";

/** Lecture CSV tolérante : séparateur , ; ou tabulation, guillemets, BOM, lignes d'en-tête parasites. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0]!;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

/**
 * Durée en minutes à partir des formats courants :
 * « 52 », « 52,5 », « 00:52:10 », « 52:10 » (min:s), « 1 h 05 min », « 1 hr 5 mins », « 3120 s ».
 */
export function parseDuration(raw: string): number | null {
  const v = raw.trim().toLowerCase().replace(",", ".");
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(Number(v));
  const hms = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/.exec(v);
  if (hms) {
    const [a, b, c] = [Number(hms[1]), Number(hms[2]), hms[3] ? Number(hms[3]) : null];
    return c === null ? Math.round(a + b / 60) : Math.round(a * 60 + b + c / 60);
  }
  let total = 0;
  let found = false;
  for (const m of v.matchAll(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|heures?|hours?|min|mins|minutes?|mn|m|s|sec|secs|secondes?|seconds?)\b/g)) {
    const n = Number(m[1]);
    const u = m[2]!;
    found = true;
    if (u.startsWith("h")) total += n * 60;
    else if (u.startsWith("s")) total += n / 60;
    else total += n;
  }
  return found ? Math.round(total) : null;
}

/** Devine les colonnes e-mail, nom et durée à partir des en-têtes (FR / EN). */
export function guessColumns(header: string[]): { email: number; name: number; minutes: number } {
  const find = (re: RegExp) => header.findIndex((h) => re.test(h.toLowerCase()));
  return {
    email: find(/e-?mail|courriel|adresse/),
    name: find(/^(nom|name|participant|full name|nom complet|display name|nom d'affichage)/),
    minutes: find(/dur[ée]e|duration|temps|minutes|time in call|temps de participation/),
  };
}

export type ImportRow = { email: string; name: string; minutes: number | null };

export type AttendanceMatch = {
  registrationId: string;
  email: string;
  registeredName: string;
  minutes: number | null;
  /** Lignes fusionnées pour cette adresse (reconnexions). */
  rows: number;
  meetsThreshold: boolean;
};

export type AttendanceAnalysis = {
  threshold: number;
  matched: AttendanceMatch[];
  /** Présents dans l'export mais non inscrits (aucune action). */
  unmatched: { email: string; name: string; minutes: number | null }[];
  /** Lignes sans adresse e-mail exploitable. */
  invalid: number;
  /** Adresses présentes plusieurs fois (durées additionnées). */
  duplicates: string[];
};

/**
 * Rapprochement par e-mail normalisé. Les reconnexions (même adresse sur
 * plusieurs lignes) sont fusionnées et leurs durées additionnées. Seules les
 * lignes au-dessus du seuil seront validées ; les autres sont signalées.
 */
export function analyzeAttendance(
  rows: ImportRow[],
  registrations: { id: string; email: string; full_name: string }[],
  threshold: number,
): AttendanceAnalysis {
  const byEmail = new Map(registrations.map((r) => [r.email, r]));
  const merged = new Map<string, { name: string; minutes: number | null; rows: number }>();
  let invalid = 0;
  for (const r of rows) {
    const email = normalizeEmail(r.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      invalid++;
      continue;
    }
    const prev = merged.get(email);
    if (prev) {
      prev.rows++;
      prev.minutes = prev.minutes === null && r.minutes === null ? null : (prev.minutes ?? 0) + (r.minutes ?? 0);
    } else merged.set(email, { name: r.name.trim(), minutes: r.minutes, rows: 1 });
  }
  const matched: AttendanceMatch[] = [];
  const unmatched: AttendanceAnalysis["unmatched"] = [];
  const duplicates: string[] = [];
  for (const [email, m] of merged) {
    if (m.rows > 1) duplicates.push(email);
    const reg = byEmail.get(email);
    if (!reg) unmatched.push({ email, name: m.name, minutes: m.minutes });
    else
      matched.push({
        registrationId: reg.id,
        email,
        registeredName: reg.full_name,
        minutes: m.minutes,
        rows: m.rows,
        meetsThreshold: m.minutes !== null && m.minutes >= threshold,
      });
  }
  return { threshold, matched, unmatched, invalid, duplicates };
}
