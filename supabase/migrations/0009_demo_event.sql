-- =============================================================================
-- 0009_demo_event.sql — Événement de démonstration
-- Un événement marqué is_demo (uniquement par le serveur, voir scripts/create-demo.mjs) :
-- toujours en ligne (pas d'expiration ni de purge) et en lecture seule pour les visiteurs,
-- qui peuvent essayer la page invités, la galerie et le Mur Live sans rien publier.
-- =============================================================================

alter table public.events add column is_demo boolean not null default false;
create unique index events_single_demo_idx on public.events (is_demo) where is_demo;

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
      new.is_demo := false;

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
      new.is_demo := old.is_demo;
      if new.date is distinct from old.date and old.date < current_date then
        new.date := old.date;
      end if;
    end if;
  end if;

  if new.plan_type <> 'premium' then
    new.moderation_enabled := false;
  end if;

  -- La démo reste en ligne en permanence.
  new.expires_at := case when new.is_demo then null else public.plan_expiry(new.plan_type, new.date) end;
  return new;
end;
$$;

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
      new.thumb_path := old.thumb_path;
      new.uploader_id := old.uploader_id;
      new.created_at := old.created_at;
      new.delete_token_hash := old.delete_token_hash;
      new.guest_name := old.guest_name;
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
    if v_event.is_demo then
      raise exception 'DEMO_READ_ONLY';
    end if;

    if new.storage_path not like new.event_id::text || '/%' or new.storage_path like '%.thumb.jpg' then
      raise exception 'INVALID_STORAGE_PATH';
    end if;

    -- La miniature doit suivre la convention de nommage ; sinon elle est ignorée.
    if new.thumb_path is not null
       and new.thumb_path <> regexp_replace(new.storage_path, '\.[^./]+$', '') || '.thumb.jpg' then
      new.thumb_path := null;
    end if;

    v_max := public.plan_max_photos(v_event.plan_type);
    if v_max is not null then
      select count(*) into v_count from public.photos where event_id = new.event_id;
      if v_count >= v_max then
        raise exception 'PHOTO_LIMIT_REACHED';
      end if;
    end if;

    new.guest_name := nullif(btrim(new.guest_name), '');
    new.caption := nullif(btrim(new.caption), '');
    -- Seule l'empreinte du jeton est conservée.
    if new.delete_token_hash is not null then
      if char_length(new.delete_token_hash) < 32 then
        new.delete_token_hash := null;
      else
        new.delete_token_hash := encode(extensions.digest(new.delete_token_hash, 'sha256'), 'hex');
      end if;
    end if;

    new.status := case when v_event.moderation_enabled then 'pending' else 'approved' end;
    new.uploader_id := auth.uid();
    new.created_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.can_upload_photo(p_object_name text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event_id uuid := public.try_uuid(split_part(p_object_name, '/', 1));
  v_event public.events%rowtype;
  v_max integer;
  v_count integer;
  v_is_thumb boolean := p_object_name like '%.thumb.jpg';
begin
  if v_event_id is null or array_length(string_to_array(p_object_name, '/'), 1) <> 2 then
    return false;
  end if;

  select * into v_event from public.events where id = v_event_id;
  if not found then return false; end if;
  if v_event.expires_at is not null and now() > v_event.expires_at then return false; end if;
  if v_event.is_demo then return false; end if;

  v_max := public.plan_max_photos(v_event.plan_type);
  if v_max is not null then
    select count(*) into v_count
    from storage.objects
    where bucket_id = 'photos'
      and name like v_event_id::text || '/%'
      and (name like '%.thumb.jpg') = v_is_thumb;
    if v_count >= v_max then return false; end if;
  end if;

  -- Photo + miniature = 2 fichiers par photo : 600 fichiers par minute et par événement.
  if public.is_client_request() and not public.rate_limit_hit('storage:' || v_event_id::text, 600, 60) then
    return false;
  end if;

  return true;
end;
$$;

drop function public.get_event_public(text);
create function public.get_event_public(p_slug text)
returns table (
  id uuid, slug text, name text, date date, bride_name text, groom_name text,
  plan_type text, moderation_enabled boolean, expires_at timestamptz,
  photo_count integer, max_photos integer, is_demo boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.slug, e.name, e.date, e.bride_name, e.groom_name,
         e.plan_type, e.moderation_enabled, e.expires_at,
         (select count(*)::integer from public.photos p where p.event_id = e.id),
         public.plan_max_photos(e.plan_type),
         e.is_demo
  from public.events e
  where e.slug = p_slug;
$$;
grant execute on function public.get_event_public(text) to anon, authenticated;
