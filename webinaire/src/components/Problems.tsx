import type { ReactNode } from "react";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const problems = [
  {
    text: "Documents introuvables au moment où on en a besoin",
    icon: icon(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M8.5 11h5" /></>),
  },
  {
    text: "Archives papier entassées sans classement",
    icon: icon(<><path d="M4 7h16v4H4zM5 11v9h14v-9" /><path d="M10 15h4" /></>),
  },
  {
    text: "Fichiers dispersés entre ordinateurs, e-mails et WhatsApp",
    icon: icon(<><rect x="3" y="4" width="11" height="8" rx="1.5" /><path d="M6.5 15.5h4M14 14l4-3h3v8h-7z" /></>),
  },
  {
    text: "Risque de perte d'information et de rupture de continuité",
    icon: icon(<><path d="M12 3 3 19h18z" /><path d="M12 10v4M12 17h.01" /></>),
  },
];

export function Problems() {
  return (
    <section aria-labelledby="problemes-title" className="on-light py-20 md:py-28">
      <div className="container-page">
        <SectionHeading
          id="problemes-title"
          eyebrow="Le constat"
          title={"Ces situations vous parlent-elles\u00A0?"}
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((p, i) => (
            <Reveal as="li" key={p.text} delay={i * 0.06} className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emeraude-soft text-forest">
                {p.icon}
              </span>
              <p className="text-body font-medium text-ink">{p.text}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
