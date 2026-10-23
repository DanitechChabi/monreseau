import { useEvent } from "../hooks/useEvent";
import { formatEventDate, formatEventTimes } from "../lib/datetime";

/** Date et heure sur fond clair, uniquement si elles sont renseignées. */
export function EventMetaLight({ className = "" }: { className?: string }) {
  const event = useEvent();
  const date = formatEventDate(event);
  const times = formatEventTimes(event);
  if (!date && !times) return null;
  return (
    <p className={`text-body text-ink-muted ${className}`}>
      {date && <span className="font-semibold text-forest first-letter:uppercase">{date}</span>}
      {date && times && <span aria-hidden="true"> · </span>}
      {times && <span>{times}</span>}
    </p>
  );
}
