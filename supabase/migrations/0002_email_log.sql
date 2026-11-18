-- =============================================================================
-- 0002_email_log.sql — Journal des emails automatiques (anti-doublon)
-- Un email d'un type donné n'est envoyé qu'une fois par événement.
-- Écriture / lecture : serveur uniquement (service_role), aucune politique RLS.
-- =============================================================================

create table public.email_log (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  kind        text not null check (kind in ('welcome', 'payment_confirmed', 'partner_sale', 'gallery_ready', 'expiring_soon')),
  ref         text not null default '',   -- ex: id de session Stripe pour payment_confirmed
  sent_to     text,
  created_at  timestamptz not null default now(),
  unique (event_id, kind, ref)
);

alter table public.email_log enable row level security;
