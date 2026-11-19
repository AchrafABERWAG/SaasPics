# 📸 SaasPhoto - Guest Verification

L'application qui transforme les invités du mariage en photographes officiels.

## 🚀 Features
- **PWA (Progressive Web App)** : Scan QR & Play. Zéro téléchargement.
- **Live Wall** : Diaporama en temps réel pour écran géant.
- **Offline Mode** : Ça marche même dans la cave du château.
- **Premium Design** : Une expérience fluide et animée.

## 🛠 Tech Stack
- **Framework** : Next.js 14+ (App Router)
- **Language** : TypeScript
- **Styling** : Vanilla CSS (No Tailwind)
- **Backend/Realtime** : Supabase

## 📂 Project Structure & Quick Links

### Public Pages
- **Landing (B2C)**: [http://localhost:3000](http://localhost:3000) (`src/app/page.tsx`)
- **Pricing**: [http://localhost:3000/pricing](http://localhost:3000/pricing) (`src/app/pricing/page.tsx`)
- **Pro Landing (B2B)**: [http://localhost:3000/pro](http://localhost:3000/pro) (`src/app/pro/page.tsx`)
- **Create Event (New)**: [http://localhost:3000/create](http://localhost:3000/create) (`src/app/create/page.tsx`)

### Espaces connectés
- **Mes événements**: `/dashboard` (`src/app/dashboard/page.tsx`)
- **Espace Pro**: `/pro/signup`, `/pro/login`, `/pro/dashboard` (lien de parrainage, ventes, commissions)

### Event Experience
- **Galerie invités**: http://localhost:3000/event/[slug]/gallery (`src/app/event/[slug]/gallery/page.tsx`)
- **Guest Admin**: http://localhost:3000/admin/[slug] (`src/app/admin/[slug]/page.tsx`)
- **Live Wall**: http://localhost:3000/live/[slug] (`src/app/live/[slug]/page.tsx`)
- **Slideshow**: http://localhost:3000/event/[slug]/slideshow (`src/app/event/[slug]/slideshow/page.tsx`)
- **Media Kit (Print)**: http://localhost:3000/admin/[slug]/print (`src/app/admin/[slug]/print/page.tsx`)

### Core Components
- **Uploader**: `src/components/PhotoUploader.tsx` (The heart of the app)
- **UI Design System**: `src/app/globals.css` (No Tailwind, pure CSS variables)

### Backend (Supabase)
- **Types**: `src/types/index.ts`
- **Client**: `src/lib/supabase.ts`
- **Migrations/Script**: `supabase/` folder

## 🏃‍♂️ Getting Started
1. **Setup Env**
   Copy `.env.example` to `.env.local` and fill in the keys (Supabase, Stripe, Resend).

2. **Run Dev**
   ```bash
   npm run dev
   ```

3. **Deploy**
   Push to Vercel/Netlify.

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
Stripe ne peut pas joindre `localhost` : utiliser la Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`) et mettre le secret qu'elle affiche dans `STRIPE_WEBHOOK_SECRET`. Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.

Test automatisé (base locale + clé `sk_test_`) : lancer le site sur le port 3100 avec la base locale et `STRIPE_WEBHOOK_SECRET=whsec_local_smoke_test_secret`, puis `npm run test:payment` (21 vérifications : sécurité du checkout, signature, idempotence, passage Essentiel → Premium, remboursement, commission partenaire).
