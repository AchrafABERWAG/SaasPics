-- =============================================================================
-- 0005_legal.sql — Preuves d'acceptation et signalements
--   * events.terms_version / terms_accepted_at : CGV acceptées à la création (obligatoire)
--   * orders.immediate_execution_requested : demande d'exécution immédiate (droit de rétractation)
--   * photo_reports : signalements de photos par les invités
-- =============================================================================

alter table public.events
  add column terms_version text check (char_length(terms_version) <= 32),
  add column terms_accepted_at timestamptz;

alter table public.orders
  add column immediate_execution_requested boolean not null default false;

create table public.photo_reports (
  id          uuid primary key default gen_random_uuid(),
  photo_id    uuid not null references public.photos(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index photo_reports_event_idx on public.photo_reports (event_id);

alter table public.photo_reports enable row level security;
-- Écriture : serveur uniquement (/api/photos/report). Lecture : l'admin de l'événement.
create policy "photo_reports_select_admin" on public.photo_reports
  for select to authenticated using (public.is_event_admin(event_id));

-- Un email "photo signalée" par photo au plus.
alter table public.email_log drop constraint email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check
  check (kind in ('welcome', 'payment_confirmed', 'partner_sale', 'gallery_ready', 'expiring_soon', 'photo_report'));


-- EVENTS : règles de 0003, plus acceptation des CGV obligatoire à la création.
create or replace function public.events_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_free_count integer;
begin
  if public.is_client_request() then
    if tg_op = 'INSERT' then
      if new.terms_version is null or new.terms_version = '' then
        raise exception 'TERMS_REQUIRED' using hint = 'Les CGV doivent être acceptées.';
      end if;
      new.terms_accepted_at := now();

      new.admin_id := auth.uid();
      new.plan_type := 'discovery';
      new.created_at := now();
      new.purged_at := null;

      select count(*) into v_free_count
      from public.events
      where admin_id = new.admin_id and plan_type = 'discovery';
      if v_free_count >= public.max_free_events_per_user() then
        raise exception 'FREE_EVENT_LIMIT' using hint = 'Nombre maximum d''événements gratuits atteint.';
      end if;

      new.referred_by := null;
      if new.ref_code is not null then
        new.ref_code := upper(trim(new.ref_code));
        select id into new.referred_by
        from public.partners
        where referral_code = new.ref_code and status = 'approved'
          and user_id <> new.admin_id;
      end if;
    else
      new.admin_id := old.admin_id;
      new.plan_type := old.plan_type;
      new.slug := old.slug;
      new.ref_code := old.ref_code;
      new.referred_by := old.referred_by;
      new.created_at := old.created_at;
      new.purged_at := old.purged_at;
      new.terms_version := old.terms_version;
      new.terms_accepted_at := old.terms_accepted_at;
      if new.date is distinct from old.date and old.date < current_date then
        new.date := old.date;
      end if;
    end if;
  end if;

  if new.plan_type <> 'premium' then
    new.moderation_enabled := false;
  end if;

  new.expires_at := public.plan_expiry(new.plan_type, new.date);
  return new;
end;
$$;
