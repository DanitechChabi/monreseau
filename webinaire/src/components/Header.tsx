import { event } from "../config/event";

const links = [
  { href: "#programme", label: "Programme" },
  { href: "#organisateurs", label: "Organisateurs" },
  { href: "#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-forest-line/70 bg-forest">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <a href="#top" className="flex min-w-0 items-baseline gap-2 font-display text-body font-semibold text-paper">
          {event.organizers.map((o, i) => (
            <span key={o.name} className="flex items-baseline gap-2">
              {i > 0 && (
                <span aria-hidden="true" className="text-emeraude">
                  ·
                </span>
              )}
              {o.name}
            </span>
          ))}
        </a>
        <nav aria-label="Navigation principale" className="flex items-center gap-1 sm:gap-2">
          <ul className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="rounded-full px-3 py-2 text-small font-medium text-mist transition-colors hover:text-paper"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#inscription"
            className="inline-flex min-h-10 items-center rounded-full bg-emeraude px-4 text-small font-semibold text-ink transition-colors hover:bg-white"
          >
            <span className="sm:hidden">S'inscrire</span>
            <span className="hidden sm:inline">Réserver ma place</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
