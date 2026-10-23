import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { useRef } from "react";
import type { EventConfig, ProgrammeItem, Speaker } from "../config/event";
import { useEvent } from "../hooks/useEvent";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

function Portrait({ speaker }: { speaker: Speaker }) {
  if (speaker.portrait) {
    // Le nom figure juste à côté : l'image est décorative pour les lecteurs d'écran.
    return (
      <img
        src={speaker.portrait}
        alt=""
        width={56}
        height={56}
        loading="lazy"
        decoding="async"
        className="h-14 w-14 rounded-full border border-line bg-emeraude-soft object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line bg-emeraude-soft font-display text-h3 text-forest"
    >
      {initials(speaker.name)}
    </span>
  );
}

function duration(event: EventConfig, item: ProgrammeItem): string | null {
  const minutes = item.kind === "talk" ? item.durationMinutes : event.qaDurationMinutes;
  if (minutes === null) return null;
  return item.kind === "talk" ? `Environ ${minutes} min` : `${minutes} min`;
}

export function Programme() {
  const event = useEvent();
  const listRef = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 75%", "end 55%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  const speakers = new Map(event.speakers.map((s) => [s.id, s]));

  return (
    <section id="programme" aria-labelledby="programme-title" className="on-light border-t border-line bg-white py-20 md:py-28">
      <div className="container-page">
        <SectionHeading
          id="programme-title"
          eyebrow="Programme"
          title="Trois regards, une même démarche"
          intro="Du diagnostic aux premières actions, chaque intervention s'appuie sur des exemples du Bénin et du Niger."
        />

        <ol ref={listRef} className="relative mt-14 max-w-3xl">
          {/* Fil de la timeline : rempli au fil du défilement */}
          <span aria-hidden="true" className="absolute top-2 bottom-2 left-[27px] w-px bg-line" />
          <motion.span
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-[27px] w-px origin-top bg-emeraude"
            style={reduce ? undefined : { scaleY: progress }}
          />

          {event.programme.map((item, i) => {
            const speaker = item.kind === "talk" ? speakers.get(item.speakerId) : undefined;
            const time = duration(event, item);
            return (
              <Reveal as="li" key={i} className="relative grid grid-cols-[56px_1fr] gap-5 pb-12 last:pb-0 sm:gap-8">
                <div className="relative z-10">
                  {speaker ? (
                    <Portrait speaker={speaker} />
                  ) : (
                    <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-forest text-paper">
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 5h11v8H8l-4 3zM15 9h5v8l-3-2h-6v-2" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="min-w-0 pt-1">
                  <p className="eyebrow flex flex-wrap gap-x-3 gap-y-1 text-ink-muted">
                    <span className="text-forest">{item.kind === "talk" ? `Partie ${i + 1}` : "Pour finir"}</span>
                    {time && <span>{time}</span>}
                  </p>
                  {speaker && <p className="mt-3 text-body font-semibold text-ink">{speaker.name}</p>}
                  <h3 className="mt-1 text-h3 text-forest">{item.title}</h3>
                  {item.kind === "talk" && (
                    <ul className="mt-4 grid gap-2">
                      {item.topics.map((t) => (
                        <li key={t} className="flex gap-3 text-body text-ink-muted">
                          <span aria-hidden="true" className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-emeraude" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
