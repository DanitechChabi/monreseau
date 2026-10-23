import { MotionConfig } from "motion/react";
import { lazy, Suspense } from "react";
import { ChaosToOrder } from "./components/ChaosToOrder";
import { Faq } from "./components/Faq";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Organizers } from "./components/Organizers";
import { PhotoBand } from "./components/PhotoBand";
import { Outcomes } from "./components/Outcomes";
import { Problems } from "./components/Problems";
import { Programme } from "./components/Programme";
import { Registration } from "./components/Registration";
import { EventProvider } from "./hooks/useEvent";
import { SmoothScroll } from "./motion/SmoothScroll";
import { ConfirmationPage } from "./pages/ConfirmationPage";
import { PrivacyPage } from "./pages/PrivacyPage";

// L'administration (et le client Supabase) n'est chargée que sur /admin.
const AdminPage = lazy(() => import("./admin/AdminPage"));

function Landing() {
  return (
    <>
      <SmoothScroll />
      <Header />
      <main id="contenu">
        <Hero />
        <Problems />
        <ChaosToOrder />
        <Programme />
        <PhotoBand />
        <Outcomes />
        <Organizers />
        <Faq />
        <Registration />
      </main>
      <Footer />
    </>
  );
}

function Route() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  switch (path) {
    case "/confirmation":
      return <ConfirmationPage />;
    case "/confidentialite":
      return <PrivacyPage />;
    case "/admin":
      return (
        <Suspense fallback={<p className="p-8 text-body text-ink-muted">Chargement…</p>}>
          <AdminPage />
        </Suspense>
      );
    default:
      return <Landing />;
  }
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <EventProvider>
        <a
          href="#contenu"
          className="sr-only z-50 rounded-full bg-emeraude px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Aller au contenu
        </a>
        <Route />
      </EventProvider>
    </MotionConfig>
  );
}
