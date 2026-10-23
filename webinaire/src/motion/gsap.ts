import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

/**
 * Requêtes partagées par toutes les séquences (gsap.matchMedia).
 * Rien ne s'anime si l'utilisateur a demandé moins d'animations ; les
 * séquences épinglées au défilement sont réservées aux grands écrans.
 */
export const MQ = {
  motion: "(prefers-reduced-motion: no-preference)",
  desktop: "(prefers-reduced-motion: no-preference) and (min-width: 1024px)",
  touchOrSmall: "(prefers-reduced-motion: no-preference) and (max-width: 1023px)",
  finePointer: "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)",
} as const;

export const EASE_OUT = "expo.out";

export { gsap, ScrollTrigger, SplitText, useGSAP };
