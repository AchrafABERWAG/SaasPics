-- =============================================================================
-- 0001_init.sql — Schéma complet (remplace les scripts de supabase/legacy/)
-- À exécuter sur un projet Supabase VIERGE (voir supabase/README.md).
--
-- Principes de sécurité :
--   * Le navigateur ne décide jamais du pack, du statut d'une photo, ni du propriétaire.
--     Des triggers imposent ces valeurs pour toute requête venant du client (anon/authenticated).
--   * Seul le serveur (clé service_role : webhook Stripe, routes API) ou le SQL Editor
--     peut changer un pack, valider un partenaire ou écrire une commande.
--   * Les invités n'accèdent aux données publiques d'un événement que via son slug
--     (fonctions RPC), sans pouvoir lister les événements ou les photos des autres.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Fonctions utilitaires
-- -----------------------------------------------------------------------------

-- Vrai si la requête vient du navigateur (clé anon + éventuel JWT utilisateur).
-- Faux pour la clé service_role et pour le SQL Editor.
-- (On lit le JWT plutôt que current_user, qui vaut le propriétaire dans une fonction SECURITY DEFINER.)
create or replace function public.is_client_request()
returns boolean
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
         in ('anon', 'authenticated');
$$;

create or replace function public.try_uuid(t text)
returns uuid
language plpgsql
immutable
as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;

-- Limites des packs (gardées synchronisées avec src/lib/plans.ts).
create or replace function public.plan_max_photos(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan when 'discovery' then 30 else null end;  -- null = illimité
$$;

-- Fin d'accès à la galerie : Découverte = 48h après le jour J, packs payants = 1 an.
create or replace function public.plan_expiry(p_plan text, p_date date)
returns timestamptz
language sql
stable
as $$
  select case p_plan
    when 'discovery' then (p_date + 3)::timestamp at time zone 'Europe/Paris'
    else ((p_date + interval '1 year')::date + 1)::timestamp at time zone 'Europe/Paris'
  end;
$$;

-- Nombre max d'événements gratuits par compte (anti-abus).
create or replace function public.max_free_events_per_user()
returns integer
language sql
immutable
as $$ select 3; $$;


-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------

-- Partenaires (photographes, wedding planners...) : section Pro.
create table public.partners (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references auth.users(id) on delete cascade,
  status             text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  first_name         text not null check (char_length(first_name) between 1 and 80),
  last_name          text not null check (char_length(last_name) between 1 and 80),
  company            text check (char_length(company) <= 120),
  activity           text not null check (activity in ('photographer', 'wedding_planner', 'venue', 'dj', 'other')),
  website            text check (char_length(website) <= 255),
  weddings_per_year  text check (weddings_per_year in ('1-10', '10-30', '30+')),
  referral_code      text unique,
  commission_rate    numeric(4, 3) not null default 0.200 check (commission_rate between 0 and 1),
  approved_at        timestamptz,
  created_at         timestamptz not null default now()
);

-- Événements (un mariage = un événement).
create table public.events (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 8 and 80),
  name                text not null check (char_length(name) between 1 and 120),
  date                date not null,
  bride_name          text check (char_length(bride_name) <= 60),
  groom_name          text check (char_length(groom_name) <= 60),
  admin_id            uuid not null references auth.users(id) on delete cascade,
  plan_type           text not null default 'discovery' check (plan_type in ('discovery', 'essential', 'premium')),
  moderation_enabled  boolean not null default false,
  expires_at          timestamptz,
  ref_code            text check (char_length(ref_code) <= 32),       -- code partenaire saisi à la création
  referred_by         uuid references public.partners(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index events_admin_id_idx on public.events (admin_id);
create index events_referred_by_idx on public.events (referred_by);

-- Photos envoyées par les invités.
create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  storage_path  text not null unique,
  caption       text check (char_length(caption) <= 280),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  uploader_id   uuid,
  created_at    timestamptz not null default now()
);
create index photos_event_status_created_idx on public.photos (event_id, status, created_at desc);

-- Défis photo (pack Premium).
create table public.challenges (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text check (char_length(description) <= 280),
  is_active    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index challenges_event_idx on public.challenges (event_id);
-- Un seul défi actif à la fois par événement.
create unique index challenges_one_active_per_event on public.challenges (event_id) where is_active;

-- Commandes Stripe (écrites uniquement par le webhook, côté serveur).
create table public.orders (
  id                     uuid primary key default gen_random_uuid(),
  event_id               uuid references public.events(id) on delete set null,
  user_id                uuid references auth.users(id) on delete set null,
  partner_id             uuid references public.partners(id) on delete set null,
  event_name             text,                 -- copie, pour l'historique et le tableau de bord Pro
  plan_type              text not null check (plan_type in ('essential', 'premium')),
  amount_cents           integer not null check (amount_cents >= 0),
  currency               text not null default 'eur',
  status                 text not null default 'paid' check (status in ('paid', 'refunded')),
  stripe_session_id      text not null unique,
  stripe_payment_intent  text,
  commission_cents       integer not null default 0 check (commission_cents >= 0),
  commission_paid_at     timestamptz,
  created_at             timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id);
create index orders_partner_idx on public.orders (partner_id);
create index orders_event_idx on public.orders (event_id);


-- -----------------------------------------------------------------------------
-- 3. Fonctions d'autorisation (utilisées par les RLS)
-- -----------------------------------------------------------------------------

create or replace function public.is_event_admin(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events
    where id = p_event_id and admin_id = auth.uid()
  );
$$;

create or replace function public.current_partner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.partners where user_id = auth.uid();
$$;


-- -----------------------------------------------------------------------------
-- 4. Triggers : valeurs imposées côté serveur
-- -----------------------------------------------------------------------------

-- PARTNERS
create or replace function public.partners_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_client_request() then
    if tg_op = 'INSERT' then
      new.user_id := auth.uid();
      new.status := 'pending';
      new.referral_code := null;
      new.commission_rate := 0.200;
      new.approved_at := null;
    else
      new.user_id := old.user_id;
      new.status := old.status;
      new.referral_code := old.referral_code;
      new.commission_rate := old.commission_rate;
      new.approved_at := old.approved_at;
      new.created_at := old.created_at;
    end if;
  end if;

  -- Validation (par vous, dans Supabase) : génère le code de parrainage.
  if new.status = 'approved' then
    if new.referral_code is null then
      new.referral_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    end if;
    if new.approved_at is null then
      new.approved_at := now();
    end if;
  end if;

  return new;
end;
$$;

create trigger partners_guard
before insert or update on public.partners
for each row execute function public.partners_guard();


-- EVENTS
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
      new.admin_id := auth.uid();
      new.plan_type := 'discovery';
      new.created_at := now();

      select count(*) into v_free_count
      from public.events
      where admin_id = new.admin_id and plan_type = 'discovery';
      if v_free_count >= public.max_free_events_per_user() then
        raise exception 'FREE_EVENT_LIMIT' using hint = 'Nombre maximum d''événements gratuits atteint.';
      end if;

      -- Rattachement à un partenaire validé via son code.
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
      -- La date ne peut plus changer une fois l'événement passé (sinon on prolongerait l'accès).
      if new.date is distinct from old.date and old.date < current_date then
        new.date := old.date;
      end if;
    end if;
  end if;

  new.expires_at := public.plan_expiry(new.plan_type, new.date);
  return new;
end;
$$;

create trigger events_guard
before insert or update on public.events
for each row execute function public.events_guard();


-- PHOTOS
create or replace function public.photos_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_max integer;
  v_count integer;
begin
  if tg_op = 'UPDATE' then
    if public.is_client_request() then
      new.event_id := old.event_id;
      new.storage_path := old.storage_path;
      new.uploader_id := old.uploader_id;
      new.created_at := old.created_at;
    end if;
    return new;
  end if;

  -- INSERT
  select * into v_event from public.events where id = new.event_id;
  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if public.is_client_request() then
    if v_event.expires_at is not null and now() > v_event.expires_at then
      raise exception 'EVENT_EXPIRED';
    end if;

    if new.storage_path not like new.event_id::text || '/%' then
      raise exception 'INVALID_STORAGE_PATH';
    end if;

    v_max := public.plan_max_photos(v_event.plan_type);
    if v_max is not null then
      select count(*) into v_count from public.photos where event_id = new.event_id;
      if v_count >= v_max then
        raise exception 'PHOTO_LIMIT_REACHED';
      end if;
    end if;

    new.status := case when v_event.moderation_enabled then 'pending' else 'approved' end;
    new.uploader_id := auth.uid();
    new.created_at := now();
  end if;

  return new;
end;
$$;

create trigger photos_guard
before insert or update on public.photos
for each row execute function public.photos_guard();


-- CHALLENGES : réservés au pack Premium.
create or replace function public.challenges_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_client_request() then
    if tg_op = 'UPDATE' then
      new.event_id := old.event_id;
      new.created_at := old.created_at;
    end if;
    if not exists (select 1 from public.events where id = new.event_id and plan_type = 'premium') then
      raise exception 'PREMIUM_REQUIRED';
    end if;
  end if;
  return new;
end;
$$;

create trigger challenges_guard
before insert or update on public.challenges
for each row execute function public.challenges_guard();


-- -----------------------------------------------------------------------------
-- 5. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.partners   enable row level security;
alter table public.events     enable row level security;
alter table public.photos     enable row level security;
alter table public.challenges enable row level security;
alter table public.orders     enable row level security;

-- PARTNERS : chacun ne voit / modifie que sa propre fiche.
create policy "partners_select_own" on public.partners
  for select to authenticated using (user_id = auth.uid());
create policy "partners_insert_own" on public.partners
  for insert to authenticated with check (user_id = auth.uid());
create policy "partners_update_own" on public.partners
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- EVENTS : seul le propriétaire lit / modifie la ligne complète.
-- (Les invités passent par public.get_event_public(slug).)
create policy "events_select_own" on public.events
  for select to authenticated using (admin_id = auth.uid());
create policy "events_insert_own" on public.events
  for insert to authenticated with check (admin_id = auth.uid());
create policy "events_update_own" on public.events
  for update to authenticated using (admin_id = auth.uid()) with check (admin_id = auth.uid());
create policy "events_delete_own" on public.events
  for delete to authenticated using (admin_id = auth.uid());

-- PHOTOS : les invités ajoutent (le trigger valide tout), l'admin voit / modère / supprime.
-- (Les invités lisent les photos approuvées via public.get_event_photos(event_id).)
create policy "photos_insert_guests" on public.photos
  for insert to anon, authenticated with check (true);
create policy "photos_select_admin" on public.photos
  for select to authenticated using (public.is_event_admin(event_id));
create policy "photos_update_admin" on public.photos
  for update to authenticated using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
create policy "photos_delete_admin" on public.photos
  for delete to authenticated using (public.is_event_admin(event_id));

-- CHALLENGES : le défi actif est public, l'admin gère tout.
create policy "challenges_select_active" on public.challenges
  for select to anon, authenticated using (is_active);
create policy "challenges_select_admin" on public.challenges
  for select to authenticated using (public.is_event_admin(event_id));
create policy "challenges_insert_admin" on public.challenges
  for insert to authenticated with check (public.is_event_admin(event_id));
create policy "challenges_update_admin" on public.challenges
  for update to authenticated using (public.is_event_admin(event_id)) with check (public.is_event_admin(event_id));
create policy "challenges_delete_admin" on public.challenges
  for delete to authenticated using (public.is_event_admin(event_id));

-- ORDERS : lecture seule (client ou partenaire concerné). Écriture : service_role uniquement.
create policy "orders_select_own" on public.orders
  for select to authenticated using (user_id = auth.uid() or partner_id = public.current_partner_id());


-- -----------------------------------------------------------------------------
-- 6. Fonctions publiques (RPC) pour les pages invités
-- -----------------------------------------------------------------------------

create or replace function public.get_event_public(p_slug text)
returns table (
  id uuid, slug text, name text, date date, bride_name text, groom_name text,
  plan_type text, moderation_enabled boolean, expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.slug, e.name, e.date, e.bride_name, e.groom_name,
         e.plan_type, e.moderation_enabled, e.expires_at
  from public.events e
  where e.slug = p_slug;
$$;

-- Photos approuvées d'un événement, de la plus récente à la plus ancienne (pagination par date).
-- Rien n'est renvoyé une fois la galerie expirée.
create or replace function public.get_event_photos(
  p_event_id uuid,
  p_limit integer default 60,
  p_before timestamptz default null
)
returns table (id uuid, storage_path text, caption text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.storage_path, p.caption, p.created_at
  from public.photos p
  join public.events e on e.id = p.event_id
  where p.event_id = p_event_id
    and p.status = 'approved'
    and (e.expires_at is null or now() <= e.expires_at)
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

grant execute on function public.get_event_public(text) to anon, authenticated;
grant execute on function public.get_event_photos(uuid, integer, timestamptz) to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 7. Temps réel
-- -----------------------------------------------------------------------------

-- Live Wall / galerie : diffusion "broadcast" sur le canal public event-photos:<event_id>,
-- uniquement pour les photos approuvées (ou qui cessent de l'être). Les invités n'ont ainsi
-- jamais besoin d'un accès en lecture à la table photos.
create or replace function public.broadcast_photo_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.photos%rowtype;
  v_visible boolean;
begin
  if tg_op = 'DELETE' then
    v_row := old;
    v_visible := false;
    if old.status <> 'approved' then return null; end if;
  else
    v_row := new;
    v_visible := new.status = 'approved';
    if tg_op = 'INSERT' and not v_visible then return null; end if;
    if tg_op = 'UPDATE' and not v_visible and old.status <> 'approved' then return null; end if;
  end if;

  begin
    perform realtime.send(
      jsonb_build_object(
        'id', v_row.id,
        'storage_path', v_row.storage_path,
        'caption', v_row.caption,
        'created_at', v_row.created_at,
        'visible', v_visible
      ),
      'photo',
      'event-photos:' || v_row.event_id::text,
      false
    );
  exception when others then
    -- Ne jamais bloquer un upload à cause du temps réel.
    null;
  end;
  return null;
end;
$$;

create trigger photos_broadcast
after insert or update or delete on public.photos
for each row execute function public.broadcast_photo_change();

-- Modération (admin) et défis (Live Wall) : postgres_changes, filtré par les RLS ci-dessus.
alter publication supabase_realtime add table public.photos, public.challenges;


-- -----------------------------------------------------------------------------
-- 8. Stockage des fichiers
-- -----------------------------------------------------------------------------

-- Bucket public (URLs non devinables : <event_id>/<uuid>.jpg), 10 Mo max, images uniquement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anciennes politiques trop permissives (au cas où elles existeraient).
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Public Upload" on storage.objects;
drop policy if exists "Enable delete for storage" on storage.objects;

-- Upload autorisé seulement dans le dossier d'un événement existant, non expiré,
-- et sous la limite de photos du pack.
create or replace function public.can_upload_photo(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event_id uuid := public.try_uuid(split_part(p_object_name, '/', 1));
  v_event public.events%rowtype;
  v_max integer;
  v_count integer;
begin
  if v_event_id is null or array_length(string_to_array(p_object_name, '/'), 1) <> 2 then
    return false;
  end if;

  select * into v_event from public.events where id = v_event_id;
  if not found then return false; end if;
  if v_event.expires_at is not null and now() > v_event.expires_at then return false; end if;

  v_max := public.plan_max_photos(v_event.plan_type);
  if v_max is not null then
    select count(*) into v_count
    from storage.objects
    where bucket_id = 'photos' and name like v_event_id::text || '/%';
    if v_count >= v_max then return false; end if;
  end if;

  return true;
end;
$$;

create policy "photos_bucket_upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'photos' and public.can_upload_photo(name));

-- Lecture via l'API (listing) et suppression : admin de l'événement uniquement.
-- (L'affichage passe par l'URL publique et ne dépend pas de ces politiques.)
create policy "photos_bucket_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.is_event_admin(public.try_uuid(split_part(name, '/', 1))));

create policy "photos_bucket_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.is_event_admin(public.try_uuid(split_part(name, '/', 1))));
