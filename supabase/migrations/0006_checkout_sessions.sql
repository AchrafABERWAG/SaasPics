-- =============================================================================
-- 0006_checkout_sessions.sql — Sessions de paiement Stripe en cours, par événement
-- Empêche de payer deux fois : une session encore ouverte est réutilisée, et un nouveau
-- paiement est refusé tant qu'un paiement réglé attend d'être appliqué par le webhook.
-- Lecture / écriture : serveur uniquement (aucune politique RLS).
-- =============================================================================

create table public.checkout_sessions (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events(id) on delete cascade,
  plan_type          text not null check (plan_type in ('essential', 'premium')),
  stripe_session_id  text not null unique,
  created_at         timestamptz not null default now()
);
create index checkout_sessions_event_idx on public.checkout_sessions (event_id, created_at desc);

alter table public.checkout_sessions enable row level security;
