# Base de données Supabase

Le schéma complet est dans `migrations/`. Les anciens scripts (`legacy/`) sont conservés pour mémoire : **ne plus les exécuter**, plusieurs ouvrent des failles de sécurité.

## Installation (projet vierge — recommandé)

L'ancienne base a été construite avec des scripts contradictoires. Le plus sûr est de repartir d'un projet neuf (l'offre gratuite permet 2 projets) :

1. Sur supabase.com : **New project** (région : `eu-west` / Paris ou Francfort, pour le RGPD).
2. **SQL Editor** → coller le contenu de `migrations/0001_init.sql` → **Run**.
3. **Authentication → URL Configuration** :
   - Site URL : la valeur de `NEXT_PUBLIC_SITE_URL`
   - Redirect URLs : ajouter `<NEXT_PUBLIC_SITE_URL>/reset-password`
4. **Project Settings → API** : copier l'URL, la clé `anon` et la clé `service_role` dans `.env.local`.

Pour ajouter une évolution plus tard : créer `migrations/0002_xxx.sql` (ne jamais modifier une migration déjà appliquée).

## Tester en local (Docker Desktop doit être lancé)

```bash
npm run db:start   # base Supabase locale (le 1er lancement télécharge les images)
npm run db:test    # 40 tests de sécurité (supabase/tests/security.test.sql)
npm run smoke      # test de bout en bout via les vraies API (upload, lecture, temps réel)
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
| Les invités ne voient que les photos **approuvées** d'un événement dont ils connaissent le lien | RPC `get_event_photos` |
| Personne ne peut lister les événements ou les photos des autres | RLS |
| Upload : 10 Mo max, images uniquement, dans le dossier d'un événement actif | bucket `photos` + `can_upload_photo` |
| Seul l'admin d'un événement modère / supprime ses photos | RLS |
| Commandes : lecture seule pour le client et le partenaire concernés | RLS `orders` |

## Valider un partenaire (section Pro)

**Table Editor → partners** → passer `status` à `approved`. Le code de parrainage (`referral_code`) est généré automatiquement.
