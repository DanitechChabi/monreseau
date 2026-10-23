# Landing page et inscriptions : webinaire Archivexa · Docflow

Sous-projet autonome, indépendant de l'application Django du dépôt.

- **Site** : React · TypeScript · Vite · Tailwind CSS v4 · Motion for React (site statique).
- **Backend** : Supabase (PostgreSQL + Auth) et Supabase Edge Functions (Deno).
- **E-mails** : Resend, appelé uniquement depuis les Edge Functions.

Le navigateur ne connaît que l'URL Supabase et la clé **anon**. La clé
`service_role` et la clé Resend restent dans les secrets des fonctions ;
`npm run test` vérifie qu'aucune clé secrète ne se retrouve dans `dist/`.

> **État actuel** : le code est complet et testé localement (base PostgreSQL
> réelle, fonctions avec Resend simulé, parcours dans un navigateur). Rien
> n'est encore déployé : **aucun e-mail réel ne partira** tant que le projet
> Supabase, les secrets, les migrations et le domaine d'envoi Resend ne sont
> pas configurés (voir « Mise en production »).

---

## Démarrage

```bash
cd webinaire
npm install
cp .env.example .env.local      # puis renseigner VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                     # http://localhost:5173
```

Sans les variables `VITE_*`, le site fonctionne mais le formulaire reste fermé
(« Les inscriptions ouvriront très bientôt »).

### Pages

| Chemin | Rôle |
|---|---|
| `/` | Landing page et formulaire d'inscription |
| `/confirmation?etat=ok\|expire\|invalide` | Résultat du clic sur le lien de confirmation |
| `/confidentialite` | Politique de confidentialité (**à valider par les organisateurs**) |
| `/admin` | Administration (lien magique, réservé à la table `admins`) |

Le site est une application monopage : l'hébergeur doit renvoyer `index.html`
pour tous les chemins. `public/_redirects` le fait pour Netlify et Cloudflare
Pages ; sur Vercel, ajouter une règle de réécriture `/(.*) → /index.html`.

---

## Contenu et réglages

- **Contenu fixe** (programme, intervenants, organisateurs, durée de conservation) :
  `supabase/functions/_shared/event.ts`, partagé par le site et les e-mails.
- **Date, heure, durée des questions-réponses, lien de participation, e-mail de contact** :
  depuis **/admin**, section « Date et informations pratiques ». Tant qu'un champ
  est vide, il n'apparaît ni sur le site ni dans les e-mails. Le lien de
  participation n'est jamais affiché sur le site : il n'est envoyé que par e-mail.
- **Prévenir les inscrits** : une fois la date enregistrée, le bouton « Envoyer
  les informations aux inscrits confirmés » leur envoie la date, l'heure et le
  lien (s'il est renseigné). Chaque version des informations n'est envoyée qu'une
  fois par personne. Si le lien est ajouté plus tard, un nouvel envoi le transmet.
- **Modèles d'e-mails** : `supabase/functions/_shared/email/templates.ts`
  (confirmation, informations pratiques, lien de connexion admin ; HTML + texte brut).

---

## Architecture

```
src/                                  site (Vite)
  components/Registration.tsx         formulaire branché sur register
  components/ResendConfirmation.tsx   « Vous n'avez pas reçu l'e-mail ? »
  pages/                              /confirmation, /confidentialite
  admin/                              /admin (chargé à la demande, seul à embarquer supabase-js)
  lib/backend.ts                      appels aux Edge Functions (clé anon uniquement)
supabase/
  migrations/                         schéma, RLS, fonctions SQL
  functions/
    _shared/                          code commun (testé sous Node et Deno)
      handlers/                       logique de chaque fonction
      email/templates.ts              modèles d'e-mails
      validation.ts                   validation partagée site + serveur
      supabase-repo.ts, runtime.ts    accès base et assemblage (Deno uniquement)
    register/ resend-confirmation/ confirm/
    admin-login/ admin-resend/ admin-announce/ purge-expired/
tests/                                vitest : fonctions, e-mails, base, secrets
scripts/                              test-db-local.sh, scan-secrets.ts
```

### Edge Functions

| Fonction | Accès | Rôle |
|---|---|---|
| `register` | public | Validation et normalisation, pot de miel, limite par IP, doublon → « déjà inscrit », jeton (hash SHA-256, 48 h), e-mail avec clé d'idempotence. Si Resend échoue, l'inscription est conservée et le statut d'envoi reste « en attente ». |
| `resend-confirmation` | public | Délai minimal (5 min) et plafonds par adresse et par IP, stockés en base. Réponse neutre. L'ancien jeton est invalidé et un nouveau est créé. |
| `confirm` | public (lien d'e-mail) | Vérifie le hash, l'expiration et la non-réutilisation, puis redirige vers `/confirmation?etat=…`. Une requête `HEAD` ne consomme pas le jeton. |
| `admin-login` | public | Envoie un lien magique aux seules adresses de `admins`. Réponse neutre. |
| `admin-resend` | admin | Inscription en attente → nouvel e-mail de confirmation ; inscription confirmée → informations pratiques. |
| `admin-announce` | admin | Envoi groupé de la date et du lien aux confirmés (lots de 100). |
| `purge-expired` | clé service_role | Supprime les inscriptions de plus de `DATA_RETENTION_MONTHS` mois. |

« admin » = JWT Supabase valide **et** adresse présente dans `admins`, vérifié
dans la fonction (403 sinon). Côté base, la RLS (`is_admin()`) filtre toutes les
lectures : un utilisateur connecté non autorisé ne voit aucune ligne.

### Base de données

`registrations`, `confirmation_tokens`, `email_log` (sans adresse e-mail),
`rate_limits` (clés = HMAC de l'e-mail ou de l'IP), `admins`, `event_settings`,
et la vue `admin_registrations` (inscription + dernier envoi). RLS activée
partout ; aucune lecture publique. Les visiteurs anonymes n'ont accès qu'à
`get_public_event_settings` (date, heure, durée Q&R, contact).

---

## Tests

```bash
npm run test              # build + tests unitaires + recherche de secrets dans dist/
npm run test:db           # migrations + tests RLS sur un PostgreSQL jetable (binaires PostgreSQL requis)
npm run check:functions   # vérification TypeScript des Edge Functions (Deno requis)
```

Avec Supabase en local, les tests de base s'exécutent aussi contre lui :
`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npx vitest run tests/db.test.ts`.

Couverture : nouvelle inscription, adresse invalide, adresse déjà inscrite,
absence de doublon (requêtes simultanées et contrainte unique), renvoi, délai et
plafonds de renvoi, jeton expiré, jeton réutilisé, jeton remplacé, échec Resend
simulé, accès admin refusé (sans session, non-admin, RLS), envoi groupé
idempotent, échappement HTML des e-mails, neutralisation des formules dans
l'export CSV, absence de clé secrète dans `dist/`.

### Lancer toute la pile en local (Docker requis)

```bash
supabase start                         # base, Auth, API ; affiche l'URL et la clé anon locales
supabase db reset                      # applique migrations + seed.sql (admin : admin@example.org)
cp .env.example supabase/functions/.env  # garder uniquement les variables de la partie 2
supabase functions serve --env-file supabase/functions/.env
npm run dev                            # avec VITE_SUPABASE_URL=http://127.0.0.1:54321
```

En local, `PUBLIC_SITE_URL=http://localhost:5173` et
`ALLOWED_ORIGINS=http://localhost:5173`. Sans `RESEND_API_KEY`, les envois
échouent proprement (`not_configured`) : l'inscription est enregistrée avec
l'état « e-mail en attente », ce qui permet de tester ce parcours.

---

## Mise en production

### 1. Supabase

1. Créer le projet (région proche de l'Afrique de l'Ouest, par ex. `eu-west`).
2. `supabase link --project-ref <ref>` puis `supabase db push` (applique `supabase/migrations/`).
3. Ajouter les administrateurs (éditeur SQL) :
   `insert into public.admins (email) values ('prenom.nom@domaine.org');`
4. **Authentication > Sign In / Providers** : désactiver « Allow new users to sign up ».
   **Authentication > URL Configuration** : *Site URL* = `PUBLIC_SITE_URL`, et
   ajouter `PUBLIC_SITE_URL/admin` aux *Redirect URLs*.
5. Secrets des fonctions :
   `supabase secrets set RESEND_API_KEY=… EMAIL_FROM="…" EMAIL_REPLY_TO=… PUBLIC_SITE_URL=… RESEND_COOLDOWN_MINUTES=5 DATA_RETENTION_MONTHS=12`
   (`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournies automatiquement).
6. `supabase functions deploy` (les réglages `verify_jwt` viennent de `supabase/config.toml`).
7. Purge automatique (RGPD) : planifier un appel quotidien à `purge-expired`
   avec la clé service_role, par exemple avec les extensions `pg_cron` et `pg_net`
   (*Integrations > Cron*), ou depuis tout planificateur externe :
   `curl -X POST https://<ref>.supabase.co/functions/v1/purge-expired -H "Authorization: Bearer <service_role>"`.

### 2. Site

Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans l'hébergeur, puis
`npm run build` → publier `dist/`.

### 3. Resend et DNS : vérifier le domaine d'envoi

Tant que le domaine n'est pas vérifié, Resend refuse les envois depuis cette
adresse (l'erreur apparaît dans /admin, colonne « dernier envoi »).

1. resend.com → **Domains → Add Domain**. Utiliser de préférence un sous-domaine
   dédié (ex. `mail.archivexa.org` ou `webinaire.archivexa.org`) pour isoler la
   réputation d'envoi du domaine principal.
2. Resend affiche les enregistrements à créer chez le gestionnaire DNS du domaine.
   Copier exactement les valeurs fournies, qui sont propres à chaque domaine :
   - **SPF** : un enregistrement `TXT` (sur le sous-domaine `send.` indiqué par
     Resend), de la forme `v=spf1 include:amazonses.com ~all`, et un enregistrement
     `MX` associé, utilisé pour les retours (bounces).
   - **DKIM** : un enregistrement `TXT` nommé `resend._domainkey` contenant la clé
     publique fournie.
3. **DMARC** (recommandé, à ajouter soi-même) : `TXT` sur `_dmarc.<domaine>` :
   `v=DMARC1; p=none; rua=mailto:dmarc@<domaine>` pour commencer, puis passer à
   `p=quarantine` une fois les rapports propres. S'il existe déjà un
   enregistrement DMARC sur le domaine, le compléter plutôt que d'en créer un second.
4. Cliquer **Verify DNS Records** dans Resend (la propagation peut prendre de
   quelques minutes à quelques heures).
5. Choisir `EMAIL_FROM` sur ce domaine vérifié, par ex.
   `Webinaire Archivexa · Docflow <webinaire@mail.archivexa.org>`.
6. Faire un essai réel : une inscription avec une adresse Gmail et une
   Outlook, en vérifiant la réception (et les courriers indésirables).

---

## À faire par les organisateurs

- [ ] Créer le projet Supabase, appliquer les migrations, déployer les fonctions (ci-dessus).
- [ ] Créer le compte Resend, vérifier le domaine d'envoi (SPF, DKIM, DMARC).
- [ ] Renseigner les secrets et les variables `VITE_*`.
- [ ] Ajouter les adresses des administrateurs dans `admins`.
- [ ] Désactiver les inscriptions publiques à Supabase Auth et déclarer l'URL `/admin`.
- [ ] Planifier la purge quotidienne (`purge-expired`).
- [ ] **Faire valider** la page `/confidentialite` (contenu, durée de conservation,
      mentions légales applicables au Bénin et au Niger).
- [ ] Valider le libellé de la case de consentement, qui nomme les trois
      organisateurs actuels de la configuration (Archivexa, Docflow, RMBI).
- [ ] Le jour venu : renseigner la date, l'heure, le lien et le contact dans
      /admin, puis « Envoyer les informations aux inscrits confirmés ».

## Points d'attention

- Certains antivirus de messagerie ouvrent les liens des e-mails avant le
  destinataire. Un tel passage consomme le lien de confirmation (l'inscription
  est alors bien confirmée) ; si la personne clique ensuite, la page indique
  que le lien n'est plus valide et qu'aucune action n'est nécessaire s'il a déjà
  été utilisé.
- La réponse « déjà inscrit » du formulaire révèle qu'une adresse est inscrite,
  comme demandé ; le renvoi de confirmation et la connexion admin, eux, ne
  révèlent rien.
- Les réponses HTTP 429 (délai de renvoi) et 409 apparaissent comme
  « Failed to load resource » dans la console du navigateur : c'est le journal
  réseau normal de Chrome, pas une erreur JavaScript.
