import { useRef, type ReactNode } from "react";
import { EASE_OUT, gsap, MQ, useGSAP } from "../motion/gsap";
import { SectionHeading } from "./SectionHeading";
import { TiltCard } from "./TiltCard";

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
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        // Cartes : arrivée en cascade avec basculement 3D.
        gsap.from("[data-problem]", {
          y: 70,
          rotateX: -18,
          opacity: 0,
          transformPerspective: 900,
          transformOrigin: "50% 100%",
          duration: 1.1,
          ease: EASE_OUT,
          stagger: 0.12,
          scrollTrigger: { trigger: "[data-problems]", start: "top 80%", once: true },
        });
        // Pictogrammes tracés trait par trait.
        const strokes = gsap.utils.toArray<SVGGeometryElement>("[data-problem] svg :is(path, circle, rect)");
        strokes.forEach((el) => {
          const len = el.getTotalLength();
          gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
        });
        gsap.to(strokes, {
          strokeDashoffset: 0,
          duration: 1.4,
          ease: "power2.inOut",
          stagger: 0.05,
          delay: 0.35,
          scrollTrigger: { trigger: "[data-problems]", start: "top 80%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="problemes-title" className="on-light py-20 md:py-28">
      <div className="container-page">
        <SectionHeading
          id="problemes-title"
          eyebrow="Le constat"
          title={"Ces situations vous parlent-elles\u00A0?"}
        />
        <ul data-problems className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((p) => (
            <li key={p.text} data-problem className="h-full">
              <TiltCard className="h-full rounded-2xl">
                <div className="flex h-full flex-col gap-5 rounded-2xl border border-line bg-white p-6 shadow-[0_1px_0_rgba(7,59,50,0.04),0_18px_40px_-28px_rgba(7,59,50,0.35)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emeraude-soft text-forest">
                    {p.icon}
                  </span>
                  <p className="text-body font-medium text-ink">{p.text}</p>
                </div>
              </TiltCard>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
