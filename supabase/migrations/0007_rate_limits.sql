-- =============================================================================
-- 0007_rate_limits.sql — Limitation de débit (anti-abus)
-- Compteur par clé et par fenêtre de temps, partagé entre toutes les instances du site
-- (contrairement à un compteur en mémoire, inutile en hébergement serverless).
-- Utilisé par les routes API (via le rôle service) et par un trigger sur les envois de photos.
-- =============================================================================

create table public.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security; -- aucune politique : serveur uniquement

-- Enregistre un appel ; renvoie false si la limite de la fenêtre courante est dépassée.
create or replace function public.rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- Nettoyage (appelé par le cron quotidien).
create or replace function public.rate_limits_cleanup()
returns integer
language sql
security definer
set search_path = public
as $$
  with d as (delete from public.rate_limits where window_start < now() - interval '1 day' returning 1)
  select count(*)::integer from d;
$$;
revoke all on function public.rate_limits_cleanup() from public, anon, authenticated;
grant execute on function public.rate_limits_cleanup() to service_role;

-- Envois de photos (directs depuis le téléphone des invités) : 300 par minute et par événement,
-- largement au-dessus d'un usage réel, mais bloque un script qui inonderait une galerie.
create or replace function public.photos_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_client_request()
     and not public.rate_limit_hit('upload:' || new.event_id::text, 300, 60) then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger photos_rate_limit
  before insert on public.photos
  for each row execute function public.photos_rate_limit();
