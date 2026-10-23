import { useRef } from "react";
import { gsap, MQ, useGSAP } from "../motion/gsap";
import { Photo, PhotoCredit } from "./Photo";

/**
 * Bandeau photographique plein écran : la photo s'ouvre (masque) puis glisse
 * plus lentement que la page (parallaxe).
 */
export function PhotoBand() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        gsap.fromTo(
          "[data-band-frame]",
          { clipPath: "inset(14% 10% 14% 10% round 28px)" },
          { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", scrollTrigger: { trigger: root.current, start: "top 90%", end: "top 15%", scrub: true } },
        );
        gsap.fromTo(
          "[data-band-img]",
          { yPercent: -12, scale: 1.25 },
          { yPercent: 12, scale: 1.08, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true } },
        );
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-label="Photographie" className="bg-white">
      <figure className="relative m-0">
        <div data-band-frame className="relative h-[56vh] min-h-[320px] overflow-hidden md:h-[78vh]">
          <div data-band-img className="absolute inset-0 will-change-transform">
            <Photo id="anb-salle" sizes="100vw" className="h-full w-full object-cover" />
          </div>
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(0deg,rgba(4,38,31,0.75)_0%,rgba(4,38,31,0)_40%)]" />
          <PhotoCredit id="anb-salle" className="absolute right-5 bottom-4 left-5 md:right-8 md:left-8" />
        </div>
      </figure>
    </section>
  );
}
