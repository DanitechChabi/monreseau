import type { RefObject } from "react";
import { EASE_OUT, gsap, MQ, SplitText, useGSAP } from "./gsap";

/**
 * Titre révélé ligne par ligne (masque), à l'entrée dans l'écran.
 * Sans animation (ou sans JavaScript), le texte est simplement affiché.
 */
export function useLineReveal(ref: RefObject<HTMLElement | null>, opts: { delay?: number; onLoad?: boolean } = {}) {
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(MQ.motion, () => {
        const split = SplitText.create(el, {
          type: "lines",
          mask: "lines",
          linesClass: "split-line",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 110,
              rotate: 2,
              duration: 1.1,
              ease: EASE_OUT,
              stagger: 0.09,
              delay: opts.delay ?? 0,
              scrollTrigger: opts.onLoad ? undefined : { trigger: el, start: "top 88%", once: true },
            }),
        });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { dependencies: [] },
  );
}
