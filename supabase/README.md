# Base de données Supabase

Le schéma complet est dans `migrations/`, à exécuter dans l’ordre (les anciens scripts SQL, qui ouvraient des failles, ont été supprimés).

## Installation (projet vierge — recommandé)

L'ancienne base a été construite avec des scripts contradictoires. Le plus sûr est de repartir d'un projet neuf (l'offre gratuite permet 2 projets) :

1. Sur supabase.com : **New project** (région : `eu-west` / Paris ou Francfort, pour le RGPD).
2. **SQL Editor** → coller puis exécuter (**Run**), dans l’ordre, chaque fichier de `migrations/` : `0001_init.sql` jusqu’à `0008_guest_photos.sql`.
3. **Authentication → URL Configuration** :
   - Site URL : la valeur de `NEXT_PUBLIC_SITE_URL`
   - Redirect URLs : ajouter `<NEXT_PUBLIC_SITE_URL>/reset-password`
4. **Project Settings → API** : copier l'URL, la clé `anon` et la clé `service_role` dans `.env.local`.

Pour ajouter une évolution plus tard : créer `migrations/0009_xxx.sql` (ne jamais modifier une migration déjà appliquée).

## Limitation de débit (anti-abus)

Migration `0007` : compteur en base, partagé par toutes les instances du site.
- Routes API : 5 à 20 appels par minute et par adresse IP selon la route (`src/lib/rate-limit.ts`), réponse 429 au-delà.
- Envois de photos : 300 par minute et par événement (trigger sur `photos`).
- Les compteurs de plus d'un jour sont effacés par le cron quotidien.

L'IP est lue dans l'en-tête `x-forwarded-for`. Sur Vercel (et la plupart des hébergeurs), cet en-tête est réécrit par la plateforme et fiable ; derrière un autre proxy, vérifier qu'il n'est pas transmis tel quel depuis le visiteur.

## Emails d'authentification (à faire avant la mise en vente)

Les emails de confirmation d'inscription et de mot de passe oublié sont envoyés par Supabase, pas par le site. Le serveur d'envoi par défaut de Supabase est limité à quelques emails par heure et réservé aux tests : **il faut brancher Resend**.

1. **Authentication → Emails → SMTP Settings** → Enable custom SMTP :
   host `smtp.resend.com`, port `465`, user `resend`, mot de passe = votre clé API Resend, expéditeur = l'adresse de `EMAIL_FROM`.
2. **Authentication → Emails → Templates** : traduire en français les modèles « Confirm signup » et « Reset password ».

## Tester en local (Docker Desktop doit être lancé)

```bash
npm run db:start   # base Supabase locale (le 1er lancement télécharge les images)
npm run db:test    # 52 tests de sécurité (supabase/tests/security.test.sql)
npm run smoke      # test de bout en bout via les vraies API (upload, lecture, temps réel)
# + npm run test:payment / test:emails / test:plans / test:pro / test:legal (site lancé en local, voir README principal)
npm run db:stop
```

`npm run db:reset` réapplique toutes les migrations sur une base locale vide.

## Ce que garantit le schéma

| Règle | Où |
|---|---|
| Un événement est toujours créé en pack `discovery` ; le pack ne change que côté serveur (webhook Stripe) | trigger `events_guard` |
| Le statut d'une photo (`pending`/`approved`) dépend de `moderation_enabled`, pas du navigateur | trigger `photos_guard` |
| Découverte : 30 photos max, galerie fermée 48 h après le jour J ; packs payants : 1 an | `plan_max_photos`, `plan_expiry` |
| 3 événements gratuits max par compte | `max_free_events_per_user` |
| Défis réservés au pack Premium, un seul actif à la fois | trigger `challenges_guard` + index unique |
| Modération réservée au pack Premium (désactivée automatiquement si le pack redescend) | trigger `events_guard` (0003) |
| Photos supprimées 7 jours après la fermeture de la galerie (l'événement et les commandes sont conservés) | `events_to_purge` + tâche quotidienne |
| Les invités ne voient que les photos **approuvées** d'un événement dont ils connaissent le lien | RPC `get_event_photos` |
| Personne ne peut lister les événements ou les photos des autres | RLS |
| Upload : 10 Mo max, images uniquement, dans le dossier d'un événement actif | bucket `photos` + `can_upload_photo` |
| Seul l'admin d'un événement modère / supprime ses photos | RLS |
| Commandes : lecture seule pour le client et le partenaire concernés | RLS `orders` |

## Valider un partenaire (section Pro)

**Table Editor → partners** → passer `status` à `approved`. Le code de parrainage (`referral_code`) est généré automatiquement. Le partenaire reçoit son lien par email lors de la tâche quotidienne suivante. Chaque nouvelle candidature vous est envoyée à `ADMIN_NOTIFICATION_EMAIL`.

Pour enregistrer le versement d'une commission : **Table Editor → orders** → renseigner `commission_paid_at`.
