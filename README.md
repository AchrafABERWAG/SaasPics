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

### Event Experience
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
