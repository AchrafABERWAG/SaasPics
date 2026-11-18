-- =============================================================================
-- 0003_plan_features.sql — Fonctionnalités par pack et suppression des galeries expirées
--   * La modération est réservée au pack Premium (comme annoncé sur la page de tarifs).
--   * events.purged_at : date à laquelle les photos d'une galerie expirée ont été supprimées.
--   * get_event_public renvoie aussi le nombre de photos et la limite du pack.
-- =============================================================================

alter table public.events add column purged_at timestamptz;

-- Délai entre la fermeture d'une galerie et la suppression de ses photos
-- (laisse le temps de passer à un pack supérieur pour les récupérer).
create or replace function public.purge_grace_period()
returns interval
language sql
immutable
as $$ select interval '7 days'; $$;


-- EVENTS : mêmes règles que 0001, plus modération Premium et purged_at verrouillé.
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
      if new.date is distinct from old.date and old.date < current_date then
        new.date := old.date;
      end if;
    end if;
  end if;

  -- Modération : Premium uniquement (s'applique aussi quand le serveur rétrograde un pack).
  if new.plan_type <> 'premium' then
    new.moderation_enabled := false;
  end if;

  new.expires_at := public.plan_expiry(new.plan_type, new.date);
  return new;
end;
$$;


-- Données publiques + compteur de photos (pour afficher "galerie pleine" aux invités).
drop function public.get_event_public(text);
create function public.get_event_public(p_slug text)
returns table (
  id uuid, slug text, name text, date date, bride_name text, groom_name text,
  plan_type text, moderation_enabled boolean, expires_at timestamptz,
  photo_count integer, max_photos integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.slug, e.name, e.date, e.bride_name, e.groom_name,
         e.plan_type, e.moderation_enabled, e.expires_at,
         (select count(*)::integer from public.photos p where p.event_id = e.id),
         public.plan_max_photos(e.plan_type)
  from public.events e
  where e.slug = p_slug;
$$;

grant execute on function public.get_event_public(text) to anon, authenticated;


-- Événements dont les photos doivent être supprimées (appelé par la tâche quotidienne).
create or replace function public.events_to_purge(p_limit integer default 50)
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.events e
  where e.purged_at is null
    and e.expires_at is not null
    and e.expires_at + public.purge_grace_period() < now()
  order by e.expires_at
  limit p_limit;
$$;

revoke execute on function public.events_to_purge(integer) from public, anon, authenticated;
