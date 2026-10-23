# Landing page — webinaire Archivexa · Docflow

Page autonome (React · TypeScript · Vite · Tailwind CSS v4 · Motion for React),
indépendante de l'application Django du dépôt.

```bash
cd webinaire
npm install
npm run dev        # développement
npm run build      # vérification TypeScript + build de production (dist/)
```

## Contenu à renseigner

Tout se règle dans `src/config/event.ts`. Une valeur à `null` n'est jamais affichée.

| Champ | Effet une fois renseigné |
|---|---|
| `date` (`AAAA-MM-JJ`) + `time` (`HH:MM`) | Date et heure dans le hero + compte à rebours |
| `qaDurationMinutes` | Durée affichée pour les questions-réponses |
| `contactEmail` | Contact dans le pied de page |
| `joinUrl` | Lien de connexion (destiné à l'e-mail d'inscription, non affiché) |
| `organizers[].logo` | Logo à la place du nom (déposer le SVG dans `public/logos/`) |
| `speakers[].portrait` | Portrait à la place des initiales |

Le formulaire d'inscription n'envoie rien (passe 1) : le branchement backend
est prévu en passe 2 (`registrationEndpoint` dans la config, `REGISTRATION_OPEN`
dans `src/components/Registration.tsx`).
