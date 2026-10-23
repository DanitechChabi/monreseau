import { useEffect, useState } from "react";
import { useEvent } from "../hooks/useEvent";
import { getEventStart } from "../lib/datetime";

function parts(ms: number) {
  const totalMinutes = Math.floor(ms / 60000);
  return {
    jours: Math.floor(totalMinutes / 1440),
    heures: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  };
}

/** Compte à rebours : n'existe que si la date ET l'heure sont confirmées et à venir. */
export function Countdown() {
  const event = useEvent();
  const startMs = getEventStart(event)?.getTime() ?? null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startMs === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [startMs]);

  if (startMs === null || startMs <= now) return null;
  const p = parts(startMs - now);

  return (
    <div className="mt-8 flex gap-3" role="timer" aria-label="Temps restant avant le webinaire">
      {Object.entries(p).map(([label, value]) => (
        <div key={label} className="min-w-20 rounded-xl border border-forest-line bg-forest-deep/60 px-4 py-3 text-center">
          <span className="block font-display text-h3 text-paper tabular-nums">{String(value).padStart(2, "0")}</span>
          <span className="eyebrow text-mist">{label}</span>
        </div>
      ))}
    </div>
  );
}
