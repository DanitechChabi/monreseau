import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect } from "react";
import { gsap, MQ, ScrollTrigger } from "./gsap";

const HEADER_OFFSET = -80;

/**
 * Défilement inertiel (Lenis) synchronisé avec ScrollTrigger.
 * Désactivé pour « réduire les animations » et sur les écrans tactiles, où le
 * défilement natif est déjà fluide. Le clavier et les ancres restent natifs.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (!window.matchMedia(MQ.finePointer).matches) return;

    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Liens internes (« /#programme ») : défilement doux, compte tenu de l'en-tête fixe.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href*='#']") as HTMLAnchorElement | null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const url = new URL(a.href, window.location.href);
      if (url.pathname !== window.location.pathname || !url.hash || url.hash === "#contenu") return;
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: url.hash === "#top" ? 0 : HEADER_OFFSET, duration: 1.4 });
      history.pushState(null, "", url.hash);
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);
  return null;
}
