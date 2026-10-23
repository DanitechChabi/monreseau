import { MotionConfig } from "motion/react";
import { Faq } from "./components/Faq";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Organizers } from "./components/Organizers";
import { Outcomes } from "./components/Outcomes";
import { Problems } from "./components/Problems";
import { Programme } from "./components/Programme";
import { Registration } from "./components/Registration";

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <a
        href="#contenu"
        className="sr-only z-50 rounded-full bg-emeraude px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Aller au contenu
      </a>
      <Header />
      <main id="contenu">
        <Hero />
        <Problems />
        <Programme />
        <Outcomes />
        <Organizers />
        <Faq />
        <Registration />
      </main>
      <Footer />
    </MotionConfig>
  );
}
