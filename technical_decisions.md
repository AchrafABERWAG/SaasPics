# Choix techniques

## Next.js 16 (App Router) + React 19
- Pages marketing et légales rendues côté serveur (SEO, rapidité) ; pages invités et espaces connectés côté client (appareil photo, temps réel).
- Routes API (`src/app/api`) uniquement pour ce qui exige un secret : paiement Stripe, webhook, emails, suppressions, cron.
- CSS pur (`src/app/globals.css`, variables CSS), pas de framework CSS. Polices auto-hébergées (`@fontsource`, aucun appel à Google Fonts).

## Supabase (Postgres, Storage, Realtime, Auth)
- **La base fait foi** : packs, limites de photos, expiration, modération et anti-abus sont appliqués par des triggers et des règles RLS (`supabase/migrations/`), jamais seulement dans l'interface. Testés par pgTAP (`supabase/tests/`).
- Les invités n'ont pas de compte : ils lisent via des fonctions publiques limitées (`get_event_public`, `get_event_photos`) et écrivent dans le bucket `photos` sous `<event_id>/…`.
- Temps réel : diffusion (`realtime.send`) des photos approuvées sur `event-photos:<id>`, pour le Mur Live et la galerie.
- Photos converties en JPEG dans le navigateur avant l'envoi, avec une miniature pour la galerie.

## Paiements : Stripe Checkout
- Paiement unique par événement. Le pack n'est appliqué **que** par le webhook signé (idempotent sur l'id de session). Anti double paiement via `checkout_sessions`.

## Emails : Resend
- Abstraction `src/lib/email.ts` (transports `resend`, `file`, `log`) ; chaque email d'événement n'est envoyé qu'une fois (`email_log`).

## Hors ligne
- File d'attente IndexedDB (`useOfflineQueue`) : les photos prises sans réseau partent au retour de la connexion, avec nouvel essai espacé.
