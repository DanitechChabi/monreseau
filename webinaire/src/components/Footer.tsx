import { useEvent } from "../hooks/useEvent";

export function Footer() {
  const event = useEvent();
  return (
    <footer className="bg-forest-deep py-12 text-mist">
      <div className="container-page flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-h3 text-paper">{event.organizers.map((o) => o.name).join(" · ")}</p>
          <p className="eyebrow mt-2 text-emeraude">{event.tagline}</p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
        <a href="/confidentialite#credits" className="text-small text-mist underline underline-offset-4 hover:text-paper">
          Confidentialité et crédits photos
        </a>
        {event.contactEmail && (
          <p className="text-small">
            Contact :{" "}
            <a href={`mailto:${event.contactEmail}`} className="font-semibold text-paper underline underline-offset-4 hover:text-emeraude">
              {event.contactEmail}
            </a>
          </p>
        )}
        </div>
      </div>
    </footer>
  );
}
