import { EventMetaLight } from "../components/EventMetaLight";
import { ResendConfirmation } from "../components/ResendConfirmation";
import { backendConfigured } from "../lib/backend";
import { btnPrimary } from "../lib/ui";
import { PageShell } from "./PageShell";

const STATES = {
  ok: {
    title: "Votre inscription est confirmée",
    text: "Merci ! Votre adresse e-mail est confirmée. Le lien de connexion vous sera envoyé par e-mail avant le webinaire.",
    resend: false,
  },
  expire: {
    title: "Ce lien a expiré",
    text: "Les liens de confirmation sont valables 48 heures. Demandez un nouvel e-mail de confirmation ci-dessous.",
    resend: true,
  },
  invalide: {
    title: "Ce lien n'est plus valide",
    text: "Il a peut-être déjà été utilisé : dans ce cas, votre inscription est bien confirmée et vous n'avez rien d'autre à faire. Sinon, demandez un nouvel e-mail de confirmation ci-dessous.",
    resend: true,
  },
  erreur: {
    title: "Un problème est survenu",
    text: "Votre adresse n'a pas pu être confirmée pour le moment. Réessayez en cliquant de nouveau sur le lien reçu par e-mail dans quelques instants.",
    resend: false,
  },
} as const;

export function ConfirmationPage() {
  const etat = new URLSearchParams(window.location.search).get("etat");
  const state = STATES[(etat ?? "") as keyof typeof STATES] ?? STATES.erreur;

  return (
    <PageShell eyebrow="Inscription au webinaire" title={state.title} docTitle={state.title}>
      <div className="max-w-2xl" role="status">
        <p className="text-lead text-ink">{state.text}</p>
        {etat === "ok" && <EventMetaLight className="mt-6" />}
      </div>
      {state.resend && backendConfigured && (
        <div className="mt-8 max-w-xl rounded-2xl border border-line bg-white p-6">
          <ResendConfirmation defaultOpen />
        </div>
      )}
      <a href="/" className={`${btnPrimary} mt-10`}>
        Retour à la présentation du webinaire
      </a>
    </PageShell>
  );
}
