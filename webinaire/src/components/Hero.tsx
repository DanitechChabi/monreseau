import { useRef } from "react";
import { event } from "../config/event";
import { btnGhostDark, btnPrimary } from "../lib/ui";
import { Magnetic } from "../motion/Magnetic";
import { EASE_OUT, gsap, MQ, SplitText, useGSAP } from "../motion/gsap";
import { Countdown } from "./Countdown";
import { EventMeta } from "./EventMeta";
import { HeroIllustration } from "./HeroIllustration";
import { Photo, PhotoCredit } from "./Photo";

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        // 1. Photo : léger travelling avant à l'arrivée (« Ken Burns »).
        gsap.fromTo("[data-hero-photo]", { scale: 1.22 }, { scale: 1.08, duration: 2.8, ease: "power2.out" });

        // 2. Titre : lignes révélées derrière un masque.
        const split = SplitText.create("[data-hero-title] > span", {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, { yPercent: 115, rotate: 3, duration: 1.25, ease: EASE_OUT, stagger: 0.1, delay: 0.15 }),
        });

        // 3. Le reste arrive en cascade.
        gsap.from("[data-hero-in]", { y: 28, opacity: 0, duration: 1, ease: EASE_OUT, stagger: 0.08, delay: 0.35 });

        // 4. Profondeur au défilement : photo lente, texte plus rapide, illustration entre les deux.
        const st = { trigger: root.current, start: "top top", end: "bottom top", scrub: true };
        gsap.to("[data-hero-photo-wrap]", { yPercent: 18, ease: "none", scrollTrigger: st });
        gsap.to("[data-hero-copy]", { yPercent: -12, opacity: 0.25, ease: "none", scrollTrigger: st });
        gsap.to("[data-hero-illu]", { yPercent: -6, ease: "none", scrollTrigger: st });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-forest text-paper">
      {/* Photo réelle d'un magasin d'archives, fortement teintée pour la lisibilité du texte. */}
      <figure aria-hidden="true" className="absolute inset-0 -z-20 m-0">
        <div data-hero-photo-wrap className="absolute inset-0">
          <div data-hero-photo className="h-full w-full scale-[1.08] will-change-transform">
            <Photo
              id="toronto-rayonnages"
              priority
              alt=""
              sizes="100vw"
              className="h-full w-full object-cover object-[50%_35%]"
              style={{ filter: "saturate(0.55) contrast(1.05)" }}
            />
          </div>
        </div>
      </figure>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(100deg, rgba(4,38,31,0.97) 0%, rgba(7,59,50,0.93) 42%, rgba(7,59,50,0.78) 70%, rgba(7,59,50,0.86) 100%), linear-gradient(0deg, #073b32 0%, rgba(7,59,50,0) 30%)",
        }}
      />
      {/* Trame discrète évoquant un registre */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(#F8FAF7 1px, transparent 1px), linear-gradient(90deg, #F8FAF7 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at 70% 40%, black 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 70% 40%, black 20%, transparent 75%)",
        }}
      />

      <div className="container-page grid items-center gap-12 pt-12 pb-16 md:pt-16 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.25fr_1fr] lg:gap-10 lg:pt-16 lg:pb-20">
        <div data-hero-copy>
          <div data-hero-in className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className="rounded-full bg-emeraude px-3 py-1 text-small font-bold text-ink">Gratuit</span>
            <span className="text-small font-semibold text-paper">{event.organizers.map((o) => o.name).join(" · ")}</span>
          </div>
          <p data-hero-in className="eyebrow mt-6 text-emeraude">
            Webinaire <span aria-hidden="true">·</span> <span className="whitespace-nowrap">{event.tagline}</span>
          </p>

          <h1 id="hero-title" data-hero-title className="mt-4 text-display text-paper">
            <span className="block">
              Vos documents vous <span className="whitespace-nowrap">échappent-ils{" "}?</span>
            </span>
            <span className="mt-2 block text-emeraude">Reprenez le contrôle de votre information.</span>
          </h1>

          <p data-hero-in className="mt-6 max-w-xl text-lead text-mist">
            Documents introuvables, archives désorganisées, fichiers dispersés{" "}: découvrez comment mieux
            organiser, sécuriser et exploiter l'information au sein de votre organisation.
          </p>

          <div data-hero-in>
            <EventMeta className="mt-6" />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Magnetic className="w-full sm:w-auto">
                <a href="#inscription" className={`${btnPrimary} w-full`}>
                  Réserver ma place
                </a>
              </Magnetic>
              <Magnetic strength={0.2} className="w-full sm:w-auto">
                <a href="#programme" className={`${btnGhostDark} w-full`}>
                  Découvrir le programme
                </a>
              </Magnetic>
            </div>
            <Countdown />
          </div>
        </div>

        <div data-hero-illu className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-none">
          <HeroIllustration />
        </div>
      </div>

      <div className="container-page pb-4">
        <PhotoCredit id="toronto-rayonnages" className="text-right text-paper/55" />
      </div>
    </section>
  );
}
