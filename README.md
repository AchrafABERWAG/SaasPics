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
   Copy `.env.local.example` to `.env.local` and add your Supabase keys.

2. **Run Dev**
   ```bash
   npm run dev
   ```

3. **Deploy**
   Push to Vercel/Netlify.
