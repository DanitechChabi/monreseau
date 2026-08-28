# MonRéseau 🐆 — Le réseau social du Bénin

Un réseau social complet, inspiré du **tissu appliqué d'Abomey** et de la culture fon, construit avec **Django 6.1** et **Bootstrap 5**.

> Identité visuelle **"Terre d'Abomey"** : palette bordeaux royal (#7B2D26) & or antique (#C99A3C), bandeau appliqué brodé d'or, logo léopard stylisé (emblème du roi Glélé).

> Architecture modulaire : chaque fonctionnalité vit dans une app Django séparée — prêt pour DRF / React / mobile.

## ✨ Fonctionnalités

| App | Fonctionnalités |
|---|---|
| **accounts** | Inscription, connexion, déconnexion, profils (avatar, photo de couverture, bio, localisation, date de naissance), édition du profil, langues béninoises (Fon, Yoruba…) + langue d'interface |
| **friends** | Demandes d'ami (envoyer / accepter / refuser / annuler), liste d'amis, suggestions, blocage |
| **posts** | Publications (texte + image + audio), fil d'actualité avec scroll infini, réactions (6 types : 👍❤️🎉😊💡🤝), commentaires (texte + audio), bookmarks, sondages, **stories** éphémères (24h), signalements, blocage |
| **search** | Recherche de personnes par pseudo, prénom ou nom |
| **notifications** | Cloche avec badge de non-lus, liste des notifications (demandes d'ami, likes, commentaires, messages), marquage lu automatique |
| **messaging** | Messages privés entre amis, liste des conversations, badge de non-lus, fil de discussion, notes vocales |
| **groups** | Création de groupes, rejoindre / quitter, publications réservées aux membres, liste des membres |
| **pages** | Création de pages, suivre / ne plus suivre, publications par le propriétaire, liste des abonnés |
| **core** | Statut en ligne (heartbeat), indicateurs de frappe, mode sombre, design PWA mobile-first, skeleton screens |

## 🛠️ Stack technique

- **Python 3.14** · **Django 6.1** · **Pillow 12** (images)
- Templates Django + **Bootstrap 5.3** (CDN) + Bootstrap Icons
- Identité **"Terre d'Abomey"** : palette CSS (`static/css/monreseau.css`), logo SVG léopard, bandeau appliqué brodé d'or, mode sombre bordeaux
- **PWA** : manifest.json, service worker, icône léopard (192/512 px)
- Base de données **SQLite** en développement
- Polling léger (JS) toutes les 30 s pour les badges de non-lus (remplaçable par WebSockets plus tard)
- **i18n** : interface en français, avec traductions (partielles) en **fon** et **yoruba** + choix de langue dans la top bar

## 🚀 Installation

```bash
# 1. Créer et activer l'environnement virtuel
python -m venv venv
venv\Scripts\activate          # PowerShell
# ou : source venv/Scripts/activate   (Git Bash)

# 2. Installer les dépendances
python -m pip install -r requirements.txt

# 3. Appliquer les migrations
python manage.py migrate

# 4. Créer un compte admin (optionnel mais pratique)
python manage.py createsuperuser

# 5. Lancer le serveur de développement
python manage.py runserver
```

Puis ouvre **http://127.0.0.1:8000/** et inscris-toi. Pour tester les fonctionnalités sociales, crée un second compte dans une fenêtre de navigation privée.

## 🌍 Langues béninoises & i18n

- **Langues parlées** : à l'inscription, l'utilisateur coche les langues béninoises qu'il parle (Fon, Yoruba, Adja, Bariba, Dendi…) ; elles s'affichent sur son profil et sont modifiables dans « Modifier le profil ». La liste vit dans `core.Language` (seedée par une data migration).
- **Langue de l'interface** : sélectionnable dans la top bar (icône globe). Le choix est enregistré sur le profil et dans un cookie. La langue source du site est le **français** ; les traductions **fon** et **yoruba** couvrent les chaînes principales.

### Compiler les traductions

Les fichiers `locale/<code>/LC_MESSAGES/django.po` sont la référence (msgid en français). Pour générer les `.mo` :

```bash
python -m pip install polib          # outil de dev
python tools/compile_i18n.py         # .po → .mo
```

> Les traductions fon/yoruba sont *best-effort* (à affiner par des locuteurs natifs directement dans les `.po`). Toute chaîne non traduite retombe automatiquement sur le français.

## 🧪 Tests

```bash
python manage.py test
```

## 📁 Structure du projet

```
social_network/          # configuration Django (settings/ base + dev, urls racine)
accounts/                # utilisateurs + profils
friends/                 # amitiés
posts/                   # publications, likes, commentaires
notifications/           # notifications + service de création
messaging/               # messages privés
groups/                  # groupes
pages/                   # pages
core/                    # fil d'accueil, recherche, mixins, context processors
templates/               # base.html + includes partagés
media/                   # fichiers téléversés (avatars, images…)
```

## 🔜 Idées d'amélioration

- Partage / repartage de publications
- Historique d'activité
- WebSockets (Django Channels) pour une messagerie instantanée
- API REST (Django REST Framework) + application mobile / frontend React
- Notifications par e-mail
