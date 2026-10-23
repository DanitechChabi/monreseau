import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

const outcomes = [
  "Identifier les points faibles de votre gestion documentaire",
  "Connaître les outils de base : plan de classement, calendrier de conservation",
  "Comprendre ce que la numérisation et la GED peuvent apporter",
  "Repartir avec des premières actions concrètes",
];

export function Outcomes() {
  return (
    <section aria-labelledby="benefices-title" className="bg-forest py-20 text-paper md:py-28">
      <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <SectionHeading id="benefices-title" tone="dark" eyebrow="À l'issue du webinaire" title="Ce que vous en retirerez" />
        <ol className="grid gap-px overflow-hidden rounded-2xl border border-forest-line bg-forest-line">
          {outcomes.map((o, i) => (
            <Reveal as="li" key={o} delay={i * 0.06} className="flex items-start gap-5 bg-forest p-6">
              <span aria-hidden="true" className="font-display text-h3 text-emeraude tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="pt-1 text-body text-paper">{o.replace(" :", " :")}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
