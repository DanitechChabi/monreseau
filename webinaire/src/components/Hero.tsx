import { motion, useReducedMotion } from "motion/react";
import { event } from "../config/event";
import { btnGhostDark, btnPrimary } from "../lib/ui";
import { Countdown } from "./Countdown";
import { EventMeta } from "./EventMeta";
import { HeroIllustration } from "./HeroIllustration";

export function Hero() {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden bg-forest text-paper"
    >
      {/* Trame discrète évoquant un registre */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#F8FAF7 1px, transparent 1px), linear-gradient(90deg, #F8FAF7 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at 70% 40%, black 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 70% 40%, black 20%, transparent 75%)",
        }}
      />
      <div className="container-page grid items-center gap-12 pt-12 pb-16 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-20 lg:pb-24">
        <div>
          <motion.div {...enter(0)} className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className="rounded-full bg-emeraude px-3 py-1 text-small font-bold text-ink">Gratuit</span>
            <span className="text-small font-semibold text-paper">
              {event.organizers.map((o) => o.name).join(" · ")}
            </span>
          </motion.div>
          <motion.p {...enter(0.05)} className="eyebrow mt-6 text-emeraude">
            Webinaire <span aria-hidden="true">·</span> <span className="whitespace-nowrap">{event.tagline}</span>
          </motion.p>

          <motion.h1 {...enter(0.1)} id="hero-title" className="mt-4 text-display text-paper">
            <span className="block">
              Vos documents vous <span className="whitespace-nowrap">échappent-ils{"\u00A0"}?</span>
            </span>
            <span className="mt-2 block text-emeraude">Reprenez le contrôle de votre information.</span>
          </motion.h1>

          <motion.p {...enter(0.2)} className="mt-6 max-w-xl text-lead text-mist">
            Documents introuvables, archives désorganisées, fichiers dispersés{" "}: découvrez comment mieux
            organiser, sécuriser et exploiter l'information au sein de votre organisation.
          </motion.p>

          <motion.div {...enter(0.3)}>
            <EventMeta className="mt-6" />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#inscription" className={btnPrimary}>
                Réserver ma place
              </a>
              <a href="#programme" className={btnGhostDark}>
                Découvrir le programme
              </a>
            </div>
            <Countdown />
          </motion.div>
        </div>

        <div className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-none">
          <HeroIllustration />
        </div>
      </div>
    </section>
  );
}
