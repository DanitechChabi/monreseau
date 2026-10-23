import { useEvent } from "../hooks/useEvent";
import { formatEventDate, formatEventTimes } from "../lib/datetime";

/** Date et heure, uniquement si elles sont confirmées dans la configuration. */
export function EventMeta({ className = "" }: { className?: string }) {
  const event = useEvent();
  const date = formatEventDate(event);
  const times = formatEventTimes(event);
  if (!date && !times) return null;
  return (
    <p className={`text-body text-mist ${className}`}>
      {date && <span className="font-semibold text-paper first-letter:uppercase">{date}</span>}
      {date && times && <span aria-hidden="true"> · </span>}
      {times && <span>{times}</span>}
    </p>
  );
}
