import { useRef } from "react";
import { EASE_OUT, gsap, MQ, useGSAP } from "../motion/gsap";
import { useLineReveal } from "../motion/useLineReveal";
import { Photo, PhotoCredit } from "./Photo";

/**
 * « Du désordre à l'ordre » : deux photographies réelles.
 * - Grand écran : section épinglée, la seconde photo se dévoile au défilement
 *   derrière un front « plan de classement », les textes se répondent.
 * - Petit écran / animations réduites : les deux photos l'une sous l'autre.
 * Sans JavaScript, la mise en page statique (deux colonnes) reste complète.
 */
export function ChaosToOrder() {
  const root = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useLineReveal(title);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(MQ.desktop, () => {
        const stage = root.current?.querySelector<HTMLElement>("[data-stage]");
        if (!stage) return;
        stage.classList.add("is-sequenced");

        gsap.set("[data-order]", { clipPath: "inset(0% 0% 0% 100%)" });
        gsap.set("[data-order-img]", { scale: 1.18 });
        gsap.set("[data-step-after]", { autoAlpha: 0, y: 40 });
        gsap.set("[data-order-credit]", { autoAlpha: 0 });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: stage, start: "top top", end: "+=170%", scrub: 0.8, pin: true, anticipatePin: 1 },
        });
        tl.to("[data-chaos-img]", { scale: 1.12, duration: 1 }, 0)
          .to("[data-order]", { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "power2.inOut" }, 0.15)
          .to("[data-front]", { left: "0%", duration: 1, ease: "power2.inOut" }, 0.15)
          .to("[data-chaos-img]", { filter: "grayscale(0.85) brightness(0.55)", duration: 0.8 }, 0.15)
          .to("[data-order-img]", { scale: 1, duration: 1.1, ease: "power2.out" }, 0.15)
          .to("[data-chaos-credit]", { autoAlpha: 0, duration: 0.1 }, 0.15)
          .to("[data-step-before]", { autoAlpha: 0, y: -40, duration: 0.3 }, 0.35)
          .to("[data-order-credit]", { autoAlpha: 1, duration: 0.15 }, 1)
          .to("[data-step-after]", { autoAlpha: 1, y: 0, duration: 0.35 }, 0.7)
          .to("[data-front]", { autoAlpha: 0, duration: 0.15 }, 1.1)
          .to("[data-progress]", { scaleX: 1, duration: 1.25 }, 0);

        return () => stage.classList.remove("is-sequenced");
      });

      mm.add(MQ.touchOrSmall, () => {
        gsap.utils.toArray<HTMLElement>("[data-panel]").forEach((panel) => {
          gsap.from(panel, {
            clipPath: "inset(18% 8% 18% 8% round 24px)",
            duration: 1.2,
            ease: EASE_OUT,
            scrollTrigger: { trigger: panel, start: "top 85%", once: true },
          });
          const img = panel.querySelector("img");
          if (img) gsap.fromTo(img, { scale: 1.2 }, { scale: 1, ease: "none", scrollTrigger: { trigger: panel, start: "top bottom", end: "bottom top", scrub: true } });
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="ordre-title" className="bg-forest-deep text-paper">
      <div className="container-page pt-20 pb-10 md:pt-28">
        <p className="eyebrow text-emeraude">La démarche</p>
        <h2 ref={title} id="ordre-title" className="mt-3 max-w-3xl text-h2 text-paper">
          Du désordre à l'ordre{"\u00A0"}: donner à chaque document sa place.
        </h2>
      </div>

      <div data-stage className="chaos-stage">
        <figure data-panel data-chaos className="chaos-panel">
          <div className="chaos-media">
            <div data-chaos-img className="h-full w-full">
              <Photo id="arewa-magasin" sizes="100vw" className="h-full w-full object-cover object-[50%_40%]" />
            </div>
          </div>
          <div className="chaos-shade" aria-hidden="true" />
          <div data-step-before className="chaos-text">
            <p className="eyebrow text-emeraude">Avant</p>
            <p className="mt-3 max-w-md font-display text-h3 text-paper">
              Des liasses accumulées au fil des années{"\u00A0"}: sans plan de classement, retrouver une pièce devient une enquête.
            </p>
          </div>
          <div data-chaos-credit><PhotoCredit id="arewa-magasin" className="chaos-credit" /></div>
        </figure>

        <figure data-panel data-order className="chaos-panel">
          <div className="chaos-media">
            <div data-order-img className="h-full w-full">
              <Photo id="boites-archives" sizes="100vw" className="h-full w-full object-cover object-[50%_45%]" />
            </div>
          </div>
          <div className="chaos-shade" aria-hidden="true" />
          <div data-step-after className="chaos-text">
            <p className="eyebrow text-emeraude">Après</p>
            <p className="mt-3 max-w-md font-display text-h3 text-paper">
              Un plan de classement, des boîtes cotées, des règles de conservation{"\u00A0"}: chaque document a sa place et se
              retrouve sans effort.
            </p>
          </div>
          <div data-order-credit><PhotoCredit id="boites-archives" className="chaos-credit" /></div>
        </figure>

        {/* Front de rangement (séquence grand écran uniquement) */}
        <div data-front className="chaos-front" aria-hidden="true">
          <span className="chaos-front-label">Plan de classement</span>
        </div>
        <div className="chaos-progress" aria-hidden="true">
          <div data-progress className="h-full origin-left scale-x-0 bg-emeraude" />
        </div>
      </div>
    </section>
  );
}
