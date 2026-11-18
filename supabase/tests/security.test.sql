-- Tests de sécurité du schéma (pgTAP). Lancer : npm run db:test
-- Chaque bloc simule un acteur : invité anonyme, admin A, autre utilisateur B, partenaire P,
-- ou le serveur (claims vides = SQL Editor / service_role).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------
-- Données de départ (en tant que serveur)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);

insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-00000000000a', 'a@test.dev', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@test.dev', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-00000000000c', 'p@test.dev', 'authenticated', 'authenticated');


-- ---------------------------------------------------------------------------
-- Admin A crée un événement en essayant de tricher
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

insert into public.events (id, slug, name, date, admin_id, plan_type, moderation_enabled)
values ('e1000000-0000-0000-0000-000000000000', 'evt-a-2027-abcdef1234', 'A & A', current_date + 30,
        'b0000000-0000-0000-0000-00000000000b', 'premium', true);

select is((select plan_type from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          'discovery', 'création : le pack est forcé à discovery');
select is((select admin_id from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          'a0000000-0000-0000-0000-00000000000a'::uuid, 'création : le propriétaire est forcé à l''utilisateur connecté');
select isnt((select expires_at from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          null, 'création : la date d''expiration est calculée');

update public.events set plan_type = 'premium' where id = 'e1000000-0000-0000-0000-000000000000';
select is((select plan_type from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          'discovery', 'modification : le client ne peut pas changer son pack');

update public.events set slug = 'evt-hijack-123456' where id = 'e1000000-0000-0000-0000-000000000000';
select is((select slug from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          'evt-a-2027-abcdef1234', 'modification : le slug (lien du QR code) est verrouillé');


-- ---------------------------------------------------------------------------
-- Utilisateur B tente d'accéder à l'événement de A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is((select count(*)::int from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          0, 'B ne peut pas lire l''événement de A');
update public.events set name = 'hacked' where id = 'e1000000-0000-0000-0000-000000000000';
delete from public.events where id = 'e1000000-0000-0000-0000-000000000000';


-- ---------------------------------------------------------------------------
-- Invité anonyme
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select is((select count(*)::int from public.events), 0, 'anon ne peut pas lister les événements');
select is((select count(*)::int from public.get_event_public('evt-a-2027-abcdef1234')), 1,
          'anon lit les infos publiques d''un événement via son slug');
select is((select count(*)::int from public.get_event_public('slug-inexistant-000')), 0,
          'slug inconnu : aucun résultat');

insert into public.photos (event_id, storage_path, status)
values ('e1000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000000/p1.jpg', 'approved');

select is((select count(*)::int from public.photos), 0, 'anon ne peut pas lister la table photos');
select throws_ok(
  $$insert into public.photos (event_id, storage_path) values ('e1000000-0000-0000-0000-000000000000', 'autre/p.jpg')$$,
  'P0001', 'INVALID_STORAGE_PATH', 'anon ne peut pas enregistrer une photo hors du dossier de l''événement');

update public.photos set status = 'approved';
delete from public.photos;

reset role;
select set_config('request.jwt.claims', '', true);

select is((select status from public.photos where storage_path like '%/p1.jpg'), 'pending',
          'modération active : la photo est mise en attente même si le client envoie approved');
select is((select count(*)::int from public.photos where event_id = 'e1000000-0000-0000-0000-000000000000'), 1, 'anon ne peut ni modifier ni supprimer une photo');
select is((select name from public.events where id = 'e1000000-0000-0000-0000-000000000000'), 'A & A',
          'les modifications et suppressions de B n''ont eu aucun effet');


-- ---------------------------------------------------------------------------
-- A désactive la modération ; les invités voient uniquement les photos approuvées
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
update public.events set moderation_enabled = false where id = 'e1000000-0000-0000-0000-000000000000';
select is((select count(*)::int from public.photos where event_id = 'e1000000-0000-0000-0000-000000000000'), 1,
          'l''admin voit toutes les photos de son événement, y compris en attente');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
insert into public.photos (event_id, storage_path)
values ('e1000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000000/p2.jpg');

select is((select count(*)::int from public.get_event_photos('e1000000-0000-0000-0000-000000000000')), 1,
          'get_event_photos ne renvoie que les photos approuvées');


-- ---------------------------------------------------------------------------
-- Limite du pack Découverte : 30 photos
-- ---------------------------------------------------------------------------
insert into public.photos (event_id, storage_path)
select 'e1000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000000/bulk' || g || '.jpg'
from generate_series(1, 28) g;

select throws_ok(
  $$insert into public.photos (event_id, storage_path) values ('e1000000-0000-0000-0000-000000000000', 'e1000000-0000-0000-0000-000000000000/p31.jpg')$$,
  'P0001', 'PHOTO_LIMIT_REACHED', 'Découverte : la 31e photo est refusée');


-- ---------------------------------------------------------------------------
-- Stockage des fichiers
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
insert into public.events (id, slug, name, date, admin_id)
values ('e2000000-0000-0000-0000-000000000000', 'evt-a2-2027-abcdef1234', 'A2', current_date + 60,
        'a0000000-0000-0000-0000-00000000000a');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
-- Les suppressions passent normalement par l'API Storage, qui active ce réglage ; les RLS s'appliquent ensuite.
select set_config('storage.allow_delete_query', 'true', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'e2000000-0000-0000-0000-000000000000/f1.jpg')$$,
  'stockage : upload autorisé dans le dossier d''un événement actif');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'pas-un-evenement/f.jpg')$$,
  '42501', null, 'stockage : upload refusé hors d''un dossier d''événement');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'e2000000-0000-0000-0000-000000000000/sous/f.jpg')$$,
  '42501', null, 'stockage : upload refusé dans un sous-dossier');
delete from storage.objects where name = 'e2000000-0000-0000-0000-000000000000/f1.jpg';

reset role;
select set_config('request.jwt.claims', '', true);
select is((select count(*)::int from storage.objects where name = 'e2000000-0000-0000-0000-000000000000/f1.jpg'), 1,
          'stockage : anon ne peut pas supprimer un fichier');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
delete from storage.objects where name = 'e2000000-0000-0000-0000-000000000000/f1.jpg';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where name = 'e2000000-0000-0000-0000-000000000000/f1.jpg'), 1,
          'stockage : un autre utilisateur ne peut pas supprimer le fichier');
delete from storage.objects where name = 'e2000000-0000-0000-0000-000000000000/f1.jpg';
select is((select count(*)::int from storage.objects where name = 'e2000000-0000-0000-0000-000000000000/f1.jpg'), 0,
          'stockage : l''admin de l''événement peut supprimer le fichier');


-- ---------------------------------------------------------------------------
-- Défis : Premium uniquement, un seul actif
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.challenges (event_id, title) values ('e2000000-0000-0000-0000-000000000000', 'Selfie')$$,
  'P0001', 'PREMIUM_REQUIRED', 'défis : refusés hors pack Premium');

reset role;
select set_config('request.jwt.claims', '', true);
update public.events set plan_type = 'premium' where id = 'e2000000-0000-0000-0000-000000000000';
select is((select plan_type from public.events where id = 'e2000000-0000-0000-0000-000000000000'), 'premium',
          'le serveur (webhook) peut changer le pack');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.challenges (event_id, title) values ('e2000000-0000-0000-0000-000000000000', 'x')$$,
  '42501', null, 'B ne peut pas créer de défi sur l''événement Premium de A');
reset role;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
insert into public.challenges (event_id, title, is_active) values ('e2000000-0000-0000-0000-000000000000', 'Défi 1', true);
insert into public.challenges (event_id, title, is_active) values ('e2000000-0000-0000-0000-000000000000', 'Défi 2', false);
select throws_ok(
  $$insert into public.challenges (event_id, title, is_active) values ('e2000000-0000-0000-0000-000000000000', 'Défi 3', true)$$,
  '23505', null, 'défis : un seul défi actif à la fois');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from public.challenges where event_id = 'e2000000-0000-0000-0000-000000000000'), 1, 'anon ne voit que le défi actif');


-- ---------------------------------------------------------------------------
-- Événements gratuits : 3 maximum par compte
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
insert into public.events (id, slug, name, date, admin_id)
values ('e3000000-0000-0000-0000-000000000000', 'evt-a3-2027-abcdef1234', 'A3', current_date + 60, 'a0000000-0000-0000-0000-00000000000a'),
       ('e4000000-0000-0000-0000-000000000000', 'evt-a4-2027-abcdef1234', 'A4', current_date + 60, 'a0000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$insert into public.events (slug, name, date, admin_id) values ('evt-a5-2027-abcdef1234', 'A5', current_date + 60, 'a0000000-0000-0000-0000-00000000000a')$$,
  'P0001', 'FREE_EVENT_LIMIT', 'un 4e événement gratuit est refusé');


-- ---------------------------------------------------------------------------
-- Commandes : écriture serveur uniquement
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.orders (event_id, user_id, plan_type, amount_cents, stripe_session_id)
    values ('e3000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'premium', 0, 'cs_fake')$$,
  '42501', null, 'un client ne peut pas créer de commande');


-- ---------------------------------------------------------------------------
-- Partenaires
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
insert into public.partners (user_id, status, referral_code, commission_rate, first_name, last_name, activity)
values ('a0000000-0000-0000-0000-00000000000a', 'approved', 'HACK', 0.9, 'Pat', 'Pro', 'photographer');

select is((select status from public.partners), 'pending', 'candidature : le statut est forcé à pending');
select is((select referral_code from public.partners), null, 'candidature : pas de code de parrainage avant validation');
select is((select commission_rate from public.partners), 0.200::numeric(4,3), 'candidature : commission forcée à 20 %');

update public.partners set status = 'approved';
select is((select status from public.partners), 'pending', 'un partenaire ne peut pas se valider lui-même');

reset role;
select set_config('request.jwt.claims', '', true);
select is((select user_id from public.partners where created_at = now()), 'c0000000-0000-0000-0000-00000000000c'::uuid,
          'candidature : rattachée à l''utilisateur connecté');
update public.partners set status = 'approved' where created_at = now();
select isnt((select referral_code from public.partners where created_at = now()), null, 'validation : le code de parrainage est généré');
select set_config('test.ref_code', (select referral_code from public.partners where created_at = now()), true);

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
insert into public.events (id, slug, name, date, admin_id, ref_code)
values ('e5000000-0000-0000-0000-000000000000', 'evt-b-2027-abcdef1234', 'B', current_date + 90,
        'b0000000-0000-0000-0000-00000000000b', lower(current_setting('test.ref_code')));

reset role;
select set_config('request.jwt.claims', '', true);
select is((select referred_by from public.events where id = 'e5000000-0000-0000-0000-000000000000'),
          (select id from public.partners where created_at = now()), 'parrainage : l''événement est rattaché au partenaire');


-- ---------------------------------------------------------------------------
-- Galerie expirée
-- ---------------------------------------------------------------------------
update public.events set date = current_date - 10 where id = 'e2000000-0000-0000-0000-000000000000';
update public.events set plan_type = 'discovery' where id = 'e2000000-0000-0000-0000-000000000000';

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$insert into public.photos (event_id, storage_path) values ('e2000000-0000-0000-0000-000000000000', 'e2000000-0000-0000-0000-000000000000/late.jpg')$$,
  'P0001', 'EVENT_EXPIRED', 'galerie expirée : plus d''envoi de photo');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('photos', 'e2000000-0000-0000-0000-000000000000/late.jpg')$$,
  '42501', null, 'galerie expirée : plus d''upload de fichier');

reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
update public.events set date = current_date + 365 where id = 'e2000000-0000-0000-0000-000000000000';
select is((select date from public.events where id = 'e2000000-0000-0000-0000-000000000000'), current_date - 10,
          'un événement passé ne peut pas être décalé pour prolonger l''accès');

reset role;
select * from finish();
rollback;
