-- =============================================================================
-- 0008_guest_photos.sql — Miniatures, prénom / petit mot de l'invité, suppression par l'invité
--
-- * thumb_path : miniature JPEG (~480 px) envoyée avec chaque photo, affichée dans les grilles
--   (galerie, admin) à la place de la photo pleine résolution : beaucoup moins de données.
--   Convention : <event_id>/<uuid>.jpg  →  <event_id>/<uuid>.thumb.jpg
-- * guest_name : prénom facultatif de l'invité (caption = petit mot facultatif, déjà existant).
-- * delete_token_hash : l'invité envoie un jeton aléatoire, gardé sur son téléphone ; la base
--   n'en conserve que l'empreinte SHA-256. Il permet de supprimer sa photo pendant 10 minutes
--   (route /api/photos/delete-own).
-- =============================================================================

alter table public.photos
  add column thumb_path text,
  add column guest_name text check (char_length(guest_name) <= 40),
  add column delete_token_hash text;

-- -----------------------------------------------------------------------------
-- Trigger de garde : mêmes règles qu'avant + nouvelles colonnes
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Lecture publique des photos : + miniature et prénom
-- -----------------------------------------------------------------------------
drop function public.get_event_photos(uuid, integer, timestamptz);
create function public.get_event_photos(
  p_event_id uuid,
  p_limit integer default 60,
  p_before timestamptz default null
)
returns table (id uuid, storage_path text, thumb_path text, caption text, guest_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.storage_path, p.thumb_path, p.caption, p.guest_name, p.created_at
  from public.photos p
  join public.events e on e.id = p.event_id
  where p.event_id = p_event_id
    and p.status = 'approved'
    and (e.expires_at is null or now() <= e.expires_at)
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;
grant execute on function public.get_event_photos(uuid, integer, timestamptz) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Temps réel : + miniature et prénom
-- -----------------------------------------------------------------------------
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
        'thumb_path', v_row.thumb_path,
        'caption', v_row.caption,
        'guest_name', v_row.guest_name,
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

-- -----------------------------------------------------------------------------
-- Stockage : les miniatures ne comptent pas dans la limite de photos du pack,
-- mais ne peuvent pas dépasser le nombre de photos autorisé ; débit limité par événement.
-- (Fonction désormais "volatile" : elle enregistre un appel dans le compteur anti-abus.)
-- -----------------------------------------------------------------------------
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
