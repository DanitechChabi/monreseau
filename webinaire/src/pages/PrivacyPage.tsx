import type { ReactNode } from "react";
import { organizerNames } from "../config/event";
import { useEvent } from "../hooks/useEvent";
import { PageShell } from "./PageShell";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-h3 text-forest">{title}</h2>
      <div className="mt-3 space-y-3 text-body text-ink">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  const event = useEvent();
  const months = event.privacy.retentionMonths;
  return (
    <PageShell eyebrow="Confidentialité" title="Vos données personnelles" docTitle="Confidentialité">
      <div className="max-w-3xl">
        <p className="inline-flex rounded-full border border-danger/40 bg-white px-3 py-1 text-small font-semibold text-danger">
          Document à valider par les organisateurs
        </p>

        <Block title="Qui collecte vos données ?">
          <p>
            Les organisateurs du webinaire : {event.organizers.map((o) => `${o.name} (${o.country})`).join(", ")}.
          </p>
        </Block>

        <Block title="Données collectées">
          <ul className="list-disc space-y-1 pl-5">
            <li>nom et prénom, adresse e-mail, organisation, fonction, pays ;</li>
            <li>numéro de téléphone, si vous choisissez de l'indiquer ;</li>
            <li>votre choix concernant les autres communications des organisateurs ;</li>
            <li>les dates d'inscription et de confirmation de votre adresse ;</li>
            <li>
              un journal technique des e-mails envoyés (type, date, statut d'envoi), sans copie de votre adresse ;
            </li>
            <li>
              pour limiter les abus, une empreinte chiffrée de votre adresse IP et de votre e-mail, supprimée automatiquement après
              quelques jours.
            </li>
          </ul>
        </Block>

        <Block title="Pourquoi ?">
          <ul className="list-disc space-y-1 pl-5">
            <li>enregistrer votre inscription et vérifier votre adresse e-mail ;</li>
            <li>vous envoyer les informations pratiques et le lien de connexion au webinaire ;</li>
            <li>établir des statistiques globales de participation (par exemple, le nombre d'inscrits par pays) ;</li>
            <li>
              vous adresser d'autres communications d'{organizerNames(event)}, uniquement si vous avez coché la case
              prévue à cet effet.
            </li>
          </ul>
          <p>Vos données ne sont ni vendues ni cédées à des tiers.</p>
        </Block>

        <Block title="Qui y a accès ?">
          <p>
            Seuls les organisateurs autorisés. Les données sont hébergées par Supabase (base de données) et les e-mails
            sont envoyés par Resend, qui agissent comme prestataires techniques.
          </p>
        </Block>

        <Block title="Combien de temps ?">
          <p>
            Vos données d'inscription sont conservées {months} mois après votre inscription, puis supprimées.
          </p>
        </Block>

        <Block title="Vos droits">
          <p>
            Vous pouvez demander l'accès à vos données, leur correction ou leur suppression, et retirer à tout moment
            votre accord pour recevoir d'autres communications.
          </p>
          {event.contactEmail ? (
            <p>
              Écrivez-nous à{" "}
              <a href={`mailto:${event.contactEmail}`} className="font-semibold text-forest underline underline-offset-2">
                {event.contactEmail}
              </a>
              .
            </p>
          ) : (
            <p>Une adresse de contact sera indiquée ici prochainement.</p>
          )}
        </Block>
      </div>
    </PageShell>
  );
}
