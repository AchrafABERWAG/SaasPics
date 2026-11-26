# Version de test (bêta) sur Vercel — liste des tâches

Objectif : mettre le site en ligne gratuitement pour que des collègues le testent.
Paiements en **mode test** (aucun argent réel), pas de nom de domaine, pas d'emails réels.
Le juridique, Stripe « live », Resend et le domaine viennent plus tard (voir `MISE-EN-LIGNE.md`).

Durée totale : environ 45 min.

---

## 0. Avant de commencer

- [ ] Choisir le nom du projet Vercel (ex. `saaspics-beta`). L'adresse du site sera
      `https://saaspics-beta.vercel.app`. Elle est notée **SITE** dans la suite.
- [ ] Donner votre accord à Claude pour envoyer le code sur GitHub : branche `release-prep`
      fusionnée dans `main`. Vercel met en ligne `main` ; les autres branches ne sont
      visibles que par vous (connexion Vercel requise).

## 1. Supabase (~15 min) — https://supabase.com

- [ ] **New project**. Nom : `saaspics-beta`. Région : Europe (Paris ou Frankfurt).
      Noter le mot de passe de la base.
- [ ] **SQL Editor** : coller puis exécuter, **une par une et dans l'ordre**, les fichiers
      `supabase/migrations/0001_init.sql` → `0009_demo_event.sql`.
      Chacune doit afficher « Success ». En cas d'erreur, s'arrêter et transmettre le message à Claude.
- [ ] **Authentication → Sign In / Providers → Email** : désactiver **« Confirm email »**.
      Sans ça, vos collègues restent bloqués : l'envoi d'emails gratuit de Supabase est très limité.
- [ ] **Authentication → URL Configuration** :
  - Site URL = `SITE`
  - Redirect URLs : ajouter `SITE/reset-password`
- [ ] **Project Settings → API** (ou « API Keys ») : copier
  - Project URL
  - clé `anon` (publique)
  - clé `service_role` (**secrète** : ne jamais la partager ni la mettre dans le code)

> Bon à savoir : le projet gratuit se met en pause après 7 jours sans visite. On le relance
> en un clic depuis le tableau de bord Supabase.

## 2. Stripe, mode test (~5 min) — https://dashboard.stripe.com

Vérifier que le bouton **« Mode test »** est activé en haut à droite.

- [ ] **Developers → API keys** : copier la clé secrète `sk_test_…`
      (la même que dans `.env.local` convient).
- [ ] **Developers → Webhooks → Add endpoint** :
  - URL : `SITE/api/stripe/webhook`
  - Événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
    `charge.refunded`
  - Copier le **Signing secret** `whsec_…`

## 3. Vercel (~10 min) — https://vercel.com

- [ ] Créer un compte avec **« Continue with GitHub »** (offre Hobby, gratuite).
- [ ] **Add New → Project** → importer le dépôt `SaasPics`.
  - Project Name : le nom choisi à l'étape 0.
  - Framework : Next.js (détecté automatiquement). Root Directory : laisser vide.
- [ ] **Environment Variables** : coller les variables suivantes avant de cliquer sur Deploy.

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `SITE`, sans slash final |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` |
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (étape 2) |
| `STRIPE_AUTOMATIC_TAX` | `false` |
| `EMAIL_TRANSPORT` | `log` (emails visibles dans les logs Vercel, aucun envoi) |
| `ADMIN_NOTIFICATION_EMAIL` | votre email |
| `CRON_SECRET` | une longue chaîne aléatoire, voir la commande ci-dessous |

Générer `CRON_SECRET` :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] Cliquer sur **Deploy** et attendre « Ready » (2 à 3 min).
- [ ] Vérifier que l'adresse obtenue est bien `SITE`. Sinon, corriger `NEXT_PUBLIC_SITE_URL`,
      la Site URL Supabase et le webhook Stripe, puis Deployments → ⋯ → **Redeploy**.

## 4. Finitions (Claude, ~5 min)

- [ ] Créer le fichier local `.env.production.local` avec les mêmes variables (jamais commité).
- [ ] `npm run check:prod -- .env.production.local` : vérifie la base, Stripe et le webhook.
      Avertissements attendus en bêta : Resend et mentions légales.
- [ ] `npm run demo:create -- .env.production.local` : crée la démo « Camille & Julien ».

## 5. Recette rapide (vous, ~10 min, avec votre téléphone)

- [ ] Créer un compte, puis un événement.
- [ ] Scanner le QR code avec le téléphone et envoyer 2 ou 3 photos.
- [ ] Ouvrir le Mur Live sur l'ordinateur : les photos arrivent sans recharger la page.
- [ ] Payer un pack avec la carte `4242 4242 4242 4242` (date future, CVC au choix) :
      le pack s'active en quelques secondes.
- [ ] Ouvrir le lien « Voir la démo » depuis l'accueil.

## 6. Inviter les collègues

À leur envoyer :
- le lien `SITE` ;
- la carte de test `4242 4242 4242 4242`, date future, CVC au choix : aucun débit réel ;
- les consignes ci-dessous, et le canal de retour choisi (groupe WhatsApp, email ou formulaire).

Pistes de test à leur proposer :
1. Créer un « faux mariage » et le configurer.
2. Imprimer ou afficher le QR code ; le faire scanner par 2 ou 3 personnes, sur iPhone et Android.
3. Envoyer des photos en mode avion, puis rallumer le réseau : elles partent toutes seules.
4. Le Mur Live sur un grand écran.
5. Passer en Premium avec la carte de test.
6. Télécharger toutes les photos (ZIP).

Questions à leur poser :
- Qu'est-ce qui vous a bloqué ou fait hésiter ?
- Sur quel téléphone et quel navigateur ?
- Paieriez-vous ce prix ? Qu'est-ce qui manque ?

## Limites connues de la bêta (normales)

- **Aucun email ne part.** Pas d'email de bienvenue ni de confirmation de paiement.
  « Mot de passe oublié » est peu fiable avec l'envoi gratuit de Supabase.
- **Mentions légales incomplètes**, avec des champs en rouge.
- **Aucun vrai paiement possible** : les clés Stripe sont en mode test.
Ajout possible par Claude avant l'envoi : un « mode bêta » qui affiche un bandeau
« Version de test » avec un bouton « Donner mon avis » (email vers l'adresse de votre choix)
et empêche Google d'indexer le site.
