import type { EventConfig } from "./event.ts";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Décalage (ms) du fuseau `timeZone` par rapport à UTC à l'instant `ts`. */
function timeZoneOffset(timeZone: string, ts: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - ts;
}

/** Instant du début du webinaire, ou `null` si la date ou l'heure ne sont pas confirmées. */
export function getEventStart(cfg: EventConfig): Date | null {
  if (!cfg.date || !cfg.time) return null;
  const d = DATE_RE.exec(cfg.date);
  const t = TIME_RE.exec(cfg.time);
  if (!d || !t) return null;
  const guess = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  return new Date(guess - timeZoneOffset(cfg.referenceTimeZone, guess));
}

/** Date seule (sans heure), si elle est renseignée et valide. */
export function formatEventDate(cfg: EventConfig): string | null {
  const d = cfg.date ? DATE_RE.exec(cfg.date) : null;
  if (!d) return null;
  // Midi UTC : évite tout basculement de jour lors du formatage.
  const noon = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), 12));
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(noon);
}

/**
 * Heure dans chaque fuseau. Les fuseaux qui affichent la même heure sont
 * regroupés (le Bénin et le Niger sont tous deux à UTC+1).
 */
export function formatEventTimes(cfg: EventConfig): string | null {
  const start = getEventStart(cfg);
  if (!start) return null;
  const groups = new Map<string, string[]>();
  for (const { label, timeZone } of cfg.timeZones) {
    const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone })
      .format(start)
      .replace(":", " h ");
    groups.set(time, [...(groups.get(time) ?? []), label]);
  }
  return [...groups.entries()]
    .map(([time, labels]) => `${time} (heure ${labels.length > 1 ? "du " + labels.join(" et du ") : "du " + labels[0]})`)
    .join(" · ");
}
