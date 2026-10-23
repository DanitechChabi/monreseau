import { useId, useState } from "react";
import { SectionHeading } from "./SectionHeading";

const faqs = [
  { q: "Le webinaire est-il gratuit ?", a: "Oui." },
  { q: "Faut-il s'inscrire ?", a: "Oui, l'inscription est obligatoire." },
  {
    q: "Comment recevrai-je le lien de connexion ?",
    a: "Par e-mail, à l'adresse indiquée lors de l'inscription.",
  },
  {
    q: "À qui s'adresse ce webinaire ?",
    a: "Aux responsables, archivistes, secrétaires, agents administratifs et à toute personne qui gère des documents dans une organisation.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <li className="border-b border-line">
      <h3 className="font-sans text-body">
        <button
          type="button"
          id={`${id}-btn`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-6 py-5 text-left text-body font-semibold text-ink transition-colors hover:text-forest"
        >
          {q}
          <span
            aria-hidden="true"
            className={`relative h-5 w-5 shrink-0 transition-transform duration-300 ease-out-soft motion-reduce:transition-none ${open ? "rotate-45" : ""}`}
          >
            <span className="absolute top-1/2 left-0 h-0.5 w-5 -translate-y-1/2 rounded bg-forest" />
            <span className="absolute top-0 left-1/2 h-5 w-0.5 -translate-x-1/2 rounded bg-forest" />
          </span>
        </button>
      </h3>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-btn`}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out-soft motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="pb-6 text-body text-ink-muted">{a}</p>
        </div>
      </div>
    </li>
  );
}

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="on-light border-t border-line bg-white py-20 md:py-28">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions fréquentes" />
        <ul className="border-t border-line">
          {faqs.map((f) => (
            <FaqItem key={f.q} {...f} />
          ))}
        </ul>
      </div>
    </section>
  );
}
