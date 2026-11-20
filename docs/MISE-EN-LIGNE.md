# Mise en ligne — checklist

À suivre dans l'ordre. Chaque étape indique **qui** la fait. Quand tout est coché,
`npm run check:prod` doit afficher « 0 point(s) bloquant(s) ».

---

## 1. Décisions à prendre (vous)

- [ ] **Nom de marque et domaine.** Le nom se change dans `src/lib/brand.ts` (un seul endroit).
  Acheter le domaine (OVH, Gandi, Cloudflare…), ~10 €/an.
- [ ] **Statut juridique.** Micro-entreprise suffit pour démarrer (déclaration gratuite sur
  formalites.entreprises.gouv.fr). Il faut un SIRET avant d'encaisser le premier euro.
- [ ] **Hébergement du site.** Vercel est le plus simple pour Next.js, mais l'offre gratuite
  (Hobby) **interdit l'usage commercial** : prévoir Vercel Pro (~20 $/mois). Alternatives :
  Netlify, Railway, Render.
- [ ] **Base de données.** Supabase gratuit **met le projet en pause après 7 jours sans activité**
  et ne fait pas de sauvegarde. Acceptable pour les tous premiers clients ; passer en Pro
  (~25 $/mois, sauvegardes quotidiennes) dès les premières ventes régulières.

## 2. Supabase de production (vous, ~20 min)

Détails : `supabase/README.md`.

- [ ] Nouveau projet, région Europe (Paris ou Francfort).
- [ ] SQL Editor : exécuter `supabase/migrations/0001` → `0009`, **dans l'ordre**.
- [ ] Authentication → URL Configuration : Site URL = votre domaine ; Redirect URL = `https://votre-domaine/reset-password`.
- [ ] Authentication → SMTP : brancher Resend (sinon les emails de confirmation sont bloqués après quelques envois).
- [ ] Authentication → Email Templates : textes en français (modèles dans `supabase/README.md`).
- [ ] Récupérer l'URL, la clé `anon` et la clé `service_role`.

## 3. Emails — Resend (vous, ~15 min + délai DNS)

- [ ] Ajouter le domaine dans Resend et créer les enregistrements DNS demandés (SPF, DKIM).
- [ ] Attendre le statut « Verified ».
- [ ] Créer une clé API « Sending access ».
- [ ] Choisir l'expéditeur, ex. `Lumina <bonjour@votre-domaine.fr>`.

## 4. Stripe (vous)

- [ ] Activer le compte (identité, IBAN, SIRET) : le Dashboard affiche « Paiements activés ».
- [ ] Paramètres → Facturation : nom commercial, logo, mentions (franchise de TVA :
  « TVA non applicable, art. 293 B du CGI » si micro-entreprise).
- [ ] Developers → Webhooks → **Add endpoint** :
  - URL : `https://votre-domaine/api/stripe/webhook`
  - Événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`
  - Copier le « Signing secret » (`whsec_…`).
- [ ] Clé secrète **live** (`sk_live_…`) — seulement le jour de l'ouverture des ventes ;
  jusque-là, garder les clés de test (le site fonctionne, aucun vrai paiement).

## 5. Mentions légales (vous + un professionnel)

- [ ] Remplir `src/lib/legal.ts` (raison sociale, SIRET, adresse, email, hébergeur…).
  Tant qu'un champ n'est pas rempli, il s'affiche en rouge sur les pages légales.
- [ ] Adhérer à un **médiateur de la consommation** (obligatoire pour vendre aux particuliers ;
  ex. CM2C, Medicys, ~50 à 150 €/an) et indiquer son nom et son site.
- [ ] Faire relire CGV, mentions légales et politique de confidentialité par un juriste
  (ou un service type Legalstart / Captain Contrat).

## 6. Déploiement (vous, ou moi si vous me donnez l'accès)

- [ ] Créer le projet chez l'hébergeur à partir du dépôt Git.
- [ ] Saisir les variables d'environnement (liste et explications : `.env.example`).
  Générer `CRON_SECRET` :
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Copier ces mêmes variables dans un fichier local `.env.production.local` (jamais commité),
  puis lancer **`npm run check:prod`** : corriger jusqu'à 0 point bloquant.
- [ ] Brancher le domaine (DNS) et vérifier le cadenas HTTPS.
- [ ] Créer l'événement de démonstration (lien « Voir la démo » de l'accueil) :
  `npm run demo:create -- .env.production.local` — à relancer si besoin, il recrée la démo à neuf.
- [ ] Vérifier que la tâche quotidienne est planifiée (Vercel : onglet Cron Jobs, via `vercel.json`).
  Ailleurs : appeler `GET /api/cron/daily` chaque jour avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.

## 7. Recette en production (vous, ~30 min, avec un téléphone)

Avec les **clés Stripe de test** encore en place :

- [ ] Créer un compte → l'email de confirmation arrive (pas dans les spams) → l'événement est créé.
- [ ] Imprimer / afficher le QR code, le scanner avec **un iPhone et un Android** :
  envoyer une photo depuis l'appareil photo et depuis la galerie.
- [ ] Couper le réseau du téléphone, prendre une photo, rallumer : elle part toute seule.
- [ ] Passer en Premium avec la carte de test `4242 4242 4242 4242` → le pack s'active en
  quelques secondes ; l'email de confirmation et la facture arrivent.
- [ ] Ouvrir le Mur Live sur un ordinateur : une photo envoyée apparaît sans recharger.
- [ ] Activer la modération, envoyer une photo, la valider depuis l'espace admin.
- [ ] Télécharger le ZIP des photos.
- [ ] Signaler une photo depuis la galerie → l'email de signalement arrive.
- [ ] Candidature Pro → email reçu sur `ADMIN_NOTIFICATION_EMAIL` → approuver dans Supabase
  (Table Editor → partners → status = approved) → le lien de parrainage fonctionne et la
  vente parrainée affiche la commission.
- [ ] Rembourser le paiement de test dans Stripe → l'événement redescend de pack.
- [ ] Supprimer l'événement de test, puis le compte de test.
- [ ] Partager le lien du site sur WhatsApp : l'aperçu (titre + image) s'affiche.

## 8. Ouverture des ventes

- [ ] Remplacer `STRIPE_SECRET_KEY` par la clé `sk_live_…` et `STRIPE_WEBHOOK_SECRET` par celui
  de l'endpoint **live** (les webhooks test et live sont séparés dans Stripe).
- [ ] `npm run check:prod` → 0 point bloquant.
- [ ] Faire un vrai paiement de 59 € sur votre propre événement, puis le rembourser.
- [ ] Soumettre le domaine dans Google Search Console (le sitemap est `https://votre-domaine/sitemap.xml`).

## Après l'ouverture — à surveiller chaque semaine

- Logs de l'hébergeur (erreurs 500), Dashboard Stripe (paiements échoués, litiges),
  Resend (emails rejetés), Supabase (espace de stockage : 1 Go en gratuit, 100 Go en Pro).
- Commissions partenaires : table `orders`, colonne `commission_cents`, à verser à la main
  (virement) puis noter le versement.

---

## Tests en local (développeur)

```bash
npm run db:start      # base locale (Docker)
npm run dev:local     # site sur http://<IP du PC>:3001, accessible depuis un téléphone
npm run test:all      # toutes les suites (types, lint, base, parcours, paiements, emails, Pro, légal)
npm run stripe:sync   # après un paiement de test en local : active le pack (pas de webhook en local)
```
