import { event } from "../config/event";
import { OrgMark } from "./OrgMark";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

export function Organizers() {
  return (
    <section id="organisateurs" aria-labelledby="organisateurs-title" className="on-light py-20 md:py-28">
      <div className="container-page">
        <SectionHeading id="organisateurs-title" eyebrow="Organisateurs" title={event.tagline} />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {event.organizers.map((o, i) => (
            <Reveal
              as="li"
              key={o.name}
              delay={i * 0.08}
              className="flex min-h-40 flex-col justify-between gap-6 rounded-2xl border border-line bg-white p-8"
            >
              <OrgMark org={o} />
              <p className="eyebrow text-ink-muted">{o.country}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
