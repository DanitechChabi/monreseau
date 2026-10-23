import { useEffect, type ReactNode } from "react";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";

/** Mise en page des pages secondaires : bandeau titre + contenu sur fond clair. */
export function PageShell({
  eyebrow,
  title,
  docTitle,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  docTitle: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = `${docTitle} · Webinaire Archivexa · Docflow`;
  }, [docTitle]);
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main id="contenu" className="flex-1">
        <section className="bg-forest py-14 text-paper md:py-20">
          <div className="container-page">
            <p className="eyebrow text-emeraude">{eyebrow}</p>
            <h1 className="mt-3 max-w-3xl text-h2 text-paper">{title}</h1>
          </div>
        </section>
        <div className="on-light container-page py-12 md:py-16">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
