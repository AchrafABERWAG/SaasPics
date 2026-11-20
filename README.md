# 📸 Lumina (nom provisoire)

Partage de photos de mariage en direct : un QR code sur les tables, les invités envoient leurs photos sans application, les mariés récupèrent tout en HD.

> **Mise en ligne : suivre [`docs/MISE-EN-LIGNE.md`](docs/MISE-EN-LIGNE.md)** puis `npm run check:prod`.

## 🚀 Fonctionnalités
- **Sans application** : scan du QR code, envoi depuis le navigateur (iPhone / Android), photos converties en JPEG.
- **Mode hors ligne** : les photos attendent sur le téléphone et partent au retour du réseau.
- **Packs** : Découverte (gratuit, 30 photos, 48 h), Essentiel, Premium (Mur Live, modération, défis).
- **Espace Pro** : parrainage, 20 % de commission.

## 🛠 Stack
- **Next.js 16** (App Router), React 19, TypeScript, CSS pur (pas de Tailwind)
- **Supabase** (Postgres + RLS, Storage, Realtime, Auth) — migrations dans `supabase/migrations/`
- **Stripe** Checkout + webhook, **Resend** pour les emails

## 📂 Project Structure & Quick Links

### Public Pages
- **Landing (B2C)**: [http://localhost:3001](http://localhost:3001) (`src/app/page.tsx`)
- **Pricing**: [http://localhost:3001/pricing](http://localhost:3001/pricing) (`src/app/pricing/page.tsx`)
- **Pro Landing (B2B)**: [http://localhost:3001/pro](http://localhost:3001/pro) (`src/app/pro/page.tsx`)
- **Create Event (New)**: [http://localhost:3001/create](http://localhost:3001/create) (`src/app/create/page.tsx`)

### Espaces connectés
- **Mes événements**: `/dashboard` (`src/app/dashboard/page.tsx`)
- **Espace Pro**: `/pro/signup`, `/pro/login`, `/pro/dashboard` (lien de parrainage, ventes, commissions)

### Event Experience
- **Galerie invités**: http://localhost:3001/event/[slug]/gallery (`src/app/event/[slug]/gallery/page.tsx`)
- **Guest Admin**: http://localhost:3001/admin/[slug] (`src/app/admin/[slug]/page.tsx`)
- **Live Wall**: http://localhost:3001/live/[slug] (`src/app/live/[slug]/page.tsx`)
- **Slideshow**: http://localhost:3001/event/[slug]/slideshow (`src/app/event/[slug]/slideshow/page.tsx`)
- **Media Kit (Print)**: http://localhost:3001/admin/[slug]/print (`src/app/admin/[slug]/print/page.tsx`)

### Core Components
- **Uploader**: `src/components/PhotoUploader.tsx` (The heart of the app)
- **UI Design System**: `src/app/globals.css` (No Tailwind, pure CSS variables)

### Backend (Supabase)
- **Types**: `src/types/index.ts`
- **Client**: `src/lib/supabase.ts`
- **Migrations/Script**: `supabase/` folder

## 🏃‍♂️ Démarrer en local
```bash
npm install
npm run db:start      # base Supabase locale (Docker Desktop doit tourner)
npm run dev:local     # site sur http://<IP du PC>:3001, ouvrable depuis un téléphone du même Wi-Fi
npm run test:all      # toutes les suites de tests (le site doit tourner)
npm run demo:create   # (re)crée l'événement de démonstration : /event/demo-mariage
```

## ✉️ Emails

| Email | Déclencheur |
|---|---|
| Bienvenue | création d'un événement gratuit (`/api/emails/welcome`, uniquement vers l'utilisateur connecté) |
| Paiement confirmé | webhook Stripe |
| Vente parrainée (au partenaire) | webhook Stripe, si la vente vient d'un code partenaire |
| Galerie prête | tâche quotidienne, le lendemain du jour J (s'il y a des photos) |
| Galerie bientôt fermée | tâche quotidienne : 24 h avant (Découverte), 7 jours avant (packs payants) |

Chaque email n'est envoyé qu'une fois (table `email_log`). Aucun mot de passe n'est jamais envoyé.

- **Envoi réel** : `RESEND_API_KEY` + `EMAIL_FROM` avec un domaine vérifié dans Resend (Domains → Add domain, puis ajouter les DNS SPF/DKIM indiqués).
- **En local** : `EMAIL_TRANSPORT=file` écrit chaque email dans `.outbox/` (rien n'est envoyé) ; `npm run test:emails` vérifie les 23 cas.
- **Tâche quotidienne** : `GET /api/cron/daily` avec `Authorization: Bearer <CRON_SECRET>`. Sur Vercel, `vercel.json` la planifie à 8 h UTC ; ailleurs, utiliser n'importe quel planificateur (ex: cron-job.org).
- **Emails d'authentification** (confirmation d'inscription, mot de passe oublié) : envoyés par Supabase, voir `supabase/README.md`.

## 💳 Paiements (Stripe)

Parcours : le client crée son événement (toujours en pack Découverte) → `/api/checkout` crée une session Stripe → après paiement, **le webhook `/api/stripe/webhook` est le seul à appliquer le pack** (et à enregistrer la commande + la commission partenaire). Le pack n'est jamais lu depuis l'URL ou le navigateur.

### Configuration (mode test pour l'instant)
1. Stripe Dashboard → **Developers → Webhooks → Add endpoint** : `https://<votre-domaine>/api/stripe/webhook`
2. Événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`
3. Copier le **Signing secret** (`whsec_...`) dans `STRIPE_WEBHOOK_SECRET`.
4. (Optionnel) `STRIPE_AUTOMATIC_TAX=true` une fois Stripe Tax configuré dans le Dashboard.

Rembourser intégralement une commande dans Stripe ramène l'événement au pack le plus élevé encore payé.

### Tester en local
Avec `npm run dev:local` (base locale, site sur le Wi-Fi du PC, port 3001) : après un paiement de test, lancer `npm run stripe:sync` pour transmettre les paiements au webhook local (le pack s'active alors). Sans ce script, la page reste sur « activation en cours » : en production, Stripe prévient le site en quelques secondes.

Alternative : Stripe ne peut pas joindre `localhost` : utiliser la Stripe CLI (`stripe listen --forward-to localhost:3001/api/stripe/webhook`) et mettre le secret qu'elle affiche dans `STRIPE_WEBHOOK_SECRET`. Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.

Test automatisé (base locale + clé `sk_test_`) : avec `npm run dev:local` lancé, `npm run test:payment` (21 vérifications : sécurité du checkout, signature, idempotence, passage Essentiel → Premium, remboursement, commission partenaire).

## ⚖️ Légal — à faire avant la mise en vente

Les pages `/mentions-legales`, `/cgv` et `/confidentialite` sont des **modèles à faire valider par un professionnel** (avocat, expert-comptable ou service juridique d'une CCI).

1. Compléter `src/lib/legal.ts` : identité, SIRET, adresse, email, hébergeur, région Supabase, médiateur de la consommation. Les valeurs non complétées apparaissent **en rouge** sur les pages.
2. Choisir un **médiateur de la consommation** (obligatoire pour vendre à des particuliers) et l'indiquer.
3. À chaque modification des CGV, changer `termsVersion` : la version acceptée est enregistrée avec chaque événement (`events.terms_version`, `terms_accepted_at`).

Ce qui est en place :
- acceptation des CGV obligatoire à la création d'un événement (vérifiée par la base) ;
- demande d'exécution immédiate cochée avant tout paiement et enregistrée sur la commande (`orders.immediate_execution_requested`) : remboursement intégral possible jusqu'à la date de l'événement ;
- mention droit à l'image / RGPD sur la page d'envoi des invités ;
- bouton « Signaler cette photo » (organisateur et `ADMIN_NOTIFICATION_EMAIL` prévenus) ;
- suppression d'un événement ou du compte depuis l'espace client (photos effacées immédiatement, factures conservées) ;
- aucune requête vers Google Fonts (polices hébergées localement).
