# PostGenius AI

**PostGenius AI** est une application web qui aide à créer, planifier, suivre et publier des posts LinkedIn assistés par intelligence artificielle. Elle combine un assistant de génération de contenu basé sur l'IA, un suivi analytique de ses propres publications, une veille concurrentielle automatisée, et la publication réelle sur LinkedIn.

Projet réalisé dans le cadre d'un **stage chez DigitGrow**, encadré par **Badr Laajali**, par :

- **Alae Lahbichi**
- **Mohamed Rayan Souleimani**

---

## Sommaire

- [Aperçu](#aperçu)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Stack technique](#stack-technique)
- [Structure du projet](#structure-du-projet)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Lancement en développement](#lancement-en-développement)
- [Équipe](#équipe)

---

## Aperçu

PostGenius AI part d'un constat simple : produire régulièrement du contenu LinkedIn pertinent demande du temps, et il est difficile de savoir *a priori* ce qui va fonctionner. L'application répond à ça en s'appuyant sur les données réelles — ses propres publications passées et celles de comptes concurrents — pour informer la génération de nouveaux posts, puis en fermant la boucle jusqu'à la publication effective.

Concrètement, l'application permet de :

1. **Synchroniser** ses propres posts LinkedIn (via Bright Data) et suivre leurs performances dans le temps.
2. **Analyser** les publications de comptes concurrents (format, hook, pattern narratif, angle, style, ton, structure, mots-clés…) grâce à un moteur d'analyse IA.
3. **Identifier** quelles dimensions (styles, formats, angles, tons…) sont statistiquement associées aux meilleures performances.
4. **Générer** un nouveau post à partir de ces dimensions, avec un modèle de langage (via OpenRouter).
5. **Publier réellement** ce post sur LinkedIn (API officielle LinkedIn), ou le garder en brouillon.

## Fonctionnalités

### 📊 Tableau de bord
Statistiques globales sur les posts personnels synchronisés (réactions, commentaires, partages, interactions totales), évolution dans le temps avec granularité ajustable (heure/jour/semaine/mois/année), et synchronisation automatique planifiable.

### ✨ Génération de posts assistée par IA
Assistant en plusieurs étapes : objectif, audience, appel à l'action, longueur, puis choix guidé du pattern narratif, du hook, de l'angle d'attaque, du style, du ton et du format — avec des recommandations basées sur l'usage et la performance historique de chaque dimension. Le texte est généré via un LLM (OpenRouter).

### 🗂️ Postes générés
Suivi des posts générés avec un vrai cycle de vie : **brouillon** → **publié** (après une publication réelle sur LinkedIn) ou **supprimé** (suppression douce, consultable séparément). Filtrage, aperçu du contenu complet, et actions directes (publier, supprimer).

### 🔗 Publication réelle sur LinkedIn
Intégration à l'API LinkedIn (UGC Posts) : le texte généré, complété des hashtags, est publié directement sur le profil LinkedIn de l'utilisateur. Un post n'est marqué "publié" dans l'application que si la publication a réellement réussi côté LinkedIn.

### 🕵️ Analyse concurrentielle
Import des publications d'un profil concurrent, puis analyse automatique par IA de chaque post (format, type, style, angle, hook, pattern, structure, outils cités, mots-clés, résumé…).

### 🧬 Caractéristiques
Vue croisée entre les dimensions analysées (styles, formats, angles, tons, structures, hooks…) et leur impact réel sur l'engagement, pour prioriser ce qui fonctionne.

### 📥 Import LinkedIn
Récupération des posts d'un profil LinkedIn (le sien ou celui d'un concurrent) via Bright Data, avec filtres (période, volume).

## Architecture

Le projet est un monorepo composé de deux applications indépendantes :

```
Stage_App_LinkPost/
├── linkpost-ai/                 # Frontend — Next.js (App Router)
└── linkpost_backend_express/    # Backend — API Express
```

Le frontend consomme exclusivement l'API du backend (aucun accès direct à la base de données ou aux services tiers depuis le client). Le backend orchestre la base MongoDB, l'API Bright Data (collecte LinkedIn), l'API OpenRouter (génération de texte) et l'API LinkedIn (publication).

```
Navigateur ──▶ Next.js (linkpost-ai, :3001)
                        │  fetch API
                        ▼
              Express (linkpost_backend_express, :3000)
                 │            │             │
                 ▼            ▼             ▼
             MongoDB     Bright Data    OpenRouter
                              │
                              ▼
                        API LinkedIn (publication)
```

## Stack technique

**Frontend**
- [Next.js 16](https://nextjs.org/) (App Router, Turbopack) + React + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) pour les graphiques

**Backend**
- [Express 5](https://expressjs.com/) (Node.js, modules ES)
- [MongoDB](https://www.mongodb.com/) (driver officiel `mongodb`)
- [Bright Data](https://brightdata.com/) — collecte de données LinkedIn (Dataset API)
- [OpenRouter](https://openrouter.ai/) — génération de texte par IA
- API LinkedIn (OAuth 2.0, UGC Posts) — publication réelle

## Structure du projet

```
linkpost_backend_express/
├── config/            # Connexion MongoDB, config Bright Data
├── controllers/        # Handlers Express par domaine
├── repositories/        # Accès MongoDB (une collection par fichier)
├── services/            # Logique métier (génération, publication LinkedIn, planification...)
├── routes/              # Déclaration des routes par domaine
└── src/                 # Point d'entrée (app.js, server.js)

linkpost-ai/
├── app/
│   ├── dashboard/        # Tableau de bord
│   ├── create/           # Assistant de génération
│   ├── generated/        # Postes générés + postes supprimés
│   ├── concurrent/        # Suivi des concurrents
│   ├── keys/              # Analyse des dimensions
│   ├── posts/, post/      # Mes posts + détail d'un post
│   ├── load_posts/        # Import LinkedIn
│   ├── contact/            # Formulaire de contact
│   └── theme.tsx           # Palette de marque + composant Logo partagé
└── public/                  # Assets statiques
```

## Installation

Prérequis : Node.js 18+, une base MongoDB accessible, une clé API Bright Data, une clé API OpenRouter, et (pour la publication réelle) un token OAuth LinkedIn avec les scopes `w_member_social`, `openid` et `profile`.

```bash
git clone https://github.com/AlaeLahbichi/PostGenius-AI.git
cd PostGenius-AI

# Backend
cd linkpost_backend_express
npm install
cp .env.example .env   # puis renseigner les valeurs (voir ci-dessous)

# Frontend
cd ../linkpost-ai
npm install
```

## Variables d'environnement

**`linkpost_backend_express/.env`**

| Variable | Description |
|---|---|
| `PORT` | Port du serveur Express (défaut : `3000`) |
| `MONGODB_URI` | URI de connexion MongoDB |
| `MONGODB_DATABASE` | Nom de la base de données |
| `BRIGHT_DATA_API_KEY` | Clé API Bright Data (collecte LinkedIn) |
| `OPENROUTER_API_KEY` | Clé API OpenRouter (génération de texte) |
| `OPENROUTER_MODEL` | Modèle utilisé pour la génération |
| `LINKEDIN_ACCESS_TOKEN` | Token OAuth LinkedIn (scopes `w_member_social`, `openid`, `profile`) |
| `LINKEDIN_AUTHOR_URN` | *(optionnel)* `urn:li:person:...` — évite de redemander le scope profil à chaque régénération de token |

**`linkpost-ai/.env.local`**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE` | URL de base de l'API backend (ex. `http://localhost:3000`) |

## Lancement en développement

```bash
# Terminal 1 — backend (port 3000)
cd linkpost_backend_express
npm run dev

# Terminal 2 — frontend (port 3001)
cd linkpost-ai
npx next dev -p 3001
```

L'application est alors accessible sur `http://localhost:3001`.

## Équipe

| | |
|---|---|
| **Réalisation** | Alae Lahbichi, Mohamed Rayan Souleimani |
| **Encadrement** | Badr Laajali |
| **Cadre** | Stage chez DigitGrow |
