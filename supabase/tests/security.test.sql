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

insert into public.events (id, slug, name, date, admin_id, plan_type, moderation_enabled, terms_version)
values ('e1000000-0000-0000-0000-000000000000', 'evt-a-2027-abcdef1234', 'A & A', current_date + 30,
        'b0000000-0000-0000-0000-00000000000b', 'premium', true, 'test');

select is((select plan_type from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          'discovery', 'création : le pack est forcé à discovery');
select is((select admin_id from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          'a0000000-0000-0000-0000-00000000000a'::uuid, 'création : le propriétaire est forcé à l''utilisateur connecté');
select isnt((select expires_at from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          null, 'création : la date d''expiration est calculée');
select isnt((select terms_accepted_at from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          null, 'création : la date d''acceptation des CGV est enregistrée');
select throws_ok(
  $$insert into public.events (slug, name, date, admin_id) values ('evt-noterms-2027-abc', 'X', current_date + 30, 'a0000000-0000-0000-0000-00000000000a')$$,
  'P0001', 'TERMS_REQUIRED', 'création refusée sans acceptation des CGV');
update public.events set terms_version = 'falsifiee', terms_accepted_at = '2000-01-01'
  where id = 'e1000000-0000-0000-0000-000000000000';
select is((select terms_version from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          'test', 'la version des CGV acceptée ne peut pas être modifiée');

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


reset role;
select set_config('request.jwt.claims', '', true);
select is((select moderation_enabled from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          false, 'Découverte : la modération ne peut pas être activée');

-- Le serveur passe l'événement en Premium (comme après paiement) : la modération devient possible.
update public.events set plan_type = 'premium' where id = 'e1000000-0000-0000-0000-000000000000';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
update public.events set moderation_enabled = true where id = 'e1000000-0000-0000-0000-000000000000';
select is((select moderation_enabled from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          true, 'Premium : l''admin peut activer la modération');
update public.events set purged_at = now() where id = 'e1000000-0000-0000-0000-000000000000';
select is((select purged_at from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          null, 'le client ne peut pas modifier purged_at');


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
-- Retour en Découverte (ex: remboursement) : la modération se désactive d'elle-même ;
-- les invités voient uniquement les photos approuvées
-- ---------------------------------------------------------------------------
update public.events set plan_type = 'discovery' where id = 'e1000000-0000-0000-0000-000000000000';
select is((select moderation_enabled from public.events where id = 'e1000000-0000-0000-0000-000000000000'),
          false, 'retour en Découverte : la modération est désactivée automatiquement');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
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
select is((select photo_count from public.get_event_public('evt-a-2027-abcdef1234')), 30,
          'get_event_public : nombre de photos visible par les invités (galerie pleine)');
select is((select max_photos from public.get_event_public('evt-a-2027-abcdef1234')), 30,
          'get_event_public : limite du pack visible par les invités');
select throws_ok($$select * from public.events_to_purge()$$, '42501', null,
          'anon ne peut pas appeler events_to_purge');


-- ---------------------------------------------------------------------------
-- Stockage des fichiers
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
insert into public.events (id, slug, name, date, admin_id, terms_version)
values ('e2000000-0000-0000-0000-000000000000', 'evt-a2-2027-abcdef1234', 'A2', current_date + 60,
        'a0000000-0000-0000-0000-00000000000a', 'test');

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
insert into public.events (id, slug, name, date, admin_id, terms_version)
values ('e3000000-0000-0000-0000-000000000000', 'evt-a3-2027-abcdef1234', 'A3', current_date + 60, 'a0000000-0000-0000-0000-00000000000a', 'test'),
       ('e4000000-0000-0000-0000-000000000000', 'evt-a4-2027-abcdef1234', 'A4', current_date + 60, 'a0000000-0000-0000-0000-00000000000a', 'test');
select throws_ok(
  $$insert into public.events (slug, name, date, admin_id, terms_version) values ('evt-a5-2027-abcdef1234', 'A5', current_date + 60, 'a0000000-0000-0000-0000-00000000000a', 'test')$$,
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

update public.partners set application_notified_at = now(), approval_notified_at = now();
select is((select application_notified_at from public.partners), null,
          'un partenaire ne peut pas marquer sa candidature comme notifiée');
select is((select approval_notified_at from public.partners), null,
          'un partenaire ne peut pas bloquer son email de validation');

reset role;
select set_config('request.jwt.claims', '', true);
select is((select user_id from public.partners where created_at = now()), 'c0000000-0000-0000-0000-00000000000c'::uuid,
          'candidature : rattachée à l''utilisateur connecté');
update public.partners set status = 'approved' where created_at = now();
select isnt((select referral_code from public.partners where created_at = now()), null, 'validation : le code de parrainage est généré');
select set_config('test.ref_code', (select referral_code from public.partners where created_at = now()), true);

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
insert into public.events (id, slug, name, date, admin_id, ref_code, terms_version)
values ('e5000000-0000-0000-0000-000000000000', 'evt-b-2027-abcdef1234', 'B', current_date + 90,
        'b0000000-0000-0000-0000-00000000000b', lower(current_setting('test.ref_code')), 'test');

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

-- ---------------------------------------------------------------------------
-- Limitation de débit (0007)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
select is(public.rate_limit_hit('test:1.2.3.4', 2, 60), true, 'rate limit : 1er appel accepté');
select is(public.rate_limit_hit('test:1.2.3.4', 2, 60), true, 'rate limit : 2e appel accepté');
select is(public.rate_limit_hit('test:1.2.3.4', 2, 60), false, 'rate limit : 3e appel refusé (limite 2)');
select is(public.rate_limit_hit('test:5.6.7.8', 2, 60), true, 'rate limit : compteur séparé par clé');

insert into public.events (id, slug, name, date, admin_id, plan_type, terms_version)
values ('e7000000-0000-0000-0000-000000000000', 'rate-limit-test-2027', 'Rate', current_date + 30,
        'a0000000-0000-0000-0000-00000000000a', 'premium', 'test');
insert into public.rate_limits (key, window_start, hits)
values ('upload:e7000000-0000-0000-0000-000000000000',
        to_timestamp(floor(extract(epoch from now()) / 60) * 60), 300);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select public.rate_limit_hit('x', 1, 60)$$, '42501', null, 'un invité ne peut pas manipuler les compteurs');
select is((select count(*)::int from public.rate_limits), 0, 'un invité ne voit pas les compteurs');
select throws_ok(
  $$insert into public.photos (event_id, storage_path) values ('e7000000-0000-0000-0000-000000000000', 'e7000000-0000-0000-0000-000000000000/flood.jpg')$$,
  'P0001', 'RATE_LIMITED', 'plus de 300 photos par minute sur un événement : refusé');
reset role;


-- ---------------------------------------------------------------------------
-- Miniatures, prénom, jeton de suppression (0008)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
insert into public.events (id, slug, name, date, admin_id, plan_type, terms_version)
values ('e8000000-0000-0000-0000-000000000000', 'guest-photos-test-2027', 'Guests', current_date + 30,
        'a0000000-0000-0000-0000-00000000000a', 'discovery', 'test');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
insert into public.photos (id, event_id, storage_path, thumb_path, guest_name, caption, delete_token_hash)
values ('f8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000000',
        'e8000000-0000-0000-0000-000000000000/abc.jpg', 'e8000000-0000-0000-0000-000000000000/abc.thumb.jpg',
        '  Mamie  ', '  Félicitations !  ', 'token-0123456789abcdef0123456789abcdef');
insert into public.photos (id, event_id, storage_path, thumb_path)
values ('f8000000-0000-0000-0000-000000000002', 'e8000000-0000-0000-0000-000000000000',
        'e8000000-0000-0000-0000-000000000000/def.jpg', 'e8000000-0000-0000-0000-000000000000/autre-chose.jpg');
select throws_ok(
  $$insert into public.photos (event_id, storage_path) values ('e8000000-0000-0000-0000-000000000000', 'e8000000-0000-0000-0000-000000000000/x.thumb.jpg')$$,
  'P0001', 'INVALID_STORAGE_PATH', 'une miniature ne peut pas être enregistrée comme photo');

select is((select guest_name || '|' || caption from public.get_event_photos('e8000000-0000-0000-0000-000000000000') where id = 'f8000000-0000-0000-0000-000000000001'),
          'Mamie|Félicitations !', 'prénom et petit mot nettoyés et visibles dans la galerie');
select is((select thumb_path from public.get_event_photos('e8000000-0000-0000-0000-000000000000') where id = 'f8000000-0000-0000-0000-000000000001'),
          'e8000000-0000-0000-0000-000000000000/abc.thumb.jpg', 'miniature conforme : conservée');
select is((select thumb_path from public.get_event_photos('e8000000-0000-0000-0000-000000000000') where id = 'f8000000-0000-0000-0000-000000000002'),
          null, 'miniature hors convention : ignorée');
reset role;

select set_config('request.jwt.claims', '', true);
select is((select delete_token_hash from public.photos where id = 'f8000000-0000-0000-0000-000000000001'),
          encode(extensions.digest('token-0123456789abcdef0123456789abcdef', 'sha256'), 'hex'),
          'jeton de suppression : seule son empreinte SHA-256 est stockée');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
update public.photos set delete_token_hash = 'x', guest_name = 'Pirate', thumb_path = null
  where id = 'f8000000-0000-0000-0000-000000000001';
reset role;
select set_config('request.jwt.claims', '', true);
select is((select guest_name || '|' || (thumb_path is not null)::text || '|' || (delete_token_hash <> 'x')::text
           from public.photos where id = 'f8000000-0000-0000-0000-000000000001'),
          'Mamie|true|true', 'prénom, miniature et jeton non modifiables depuis l''application');

-- Limite de 30 fichiers du pack Découverte : les miniatures ne comptent pas comme des photos.
insert into storage.objects (bucket_id, name)
select 'photos', 'e8000000-0000-0000-0000-000000000000/t' || g || '.thumb.jpg' from generate_series(1, 29) g;
select is(public.can_upload_photo('e8000000-0000-0000-0000-000000000000/new.jpg'), true,
          '29 miniatures stockées : une nouvelle photo reste possible');
insert into storage.objects (bucket_id, name)
values ('photos', 'e8000000-0000-0000-0000-000000000000/t30.thumb.jpg');
select is(public.can_upload_photo('e8000000-0000-0000-0000-000000000000/t31.thumb.jpg'), false,
          'pas plus de miniatures que de photos autorisées');

-- ---------------------------------------------------------------------------
-- Événement de démonstration (0009)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
update public.events set is_demo = false where is_demo; -- une seule démo autorisée (annulé par le rollback)
insert into public.events (id, slug, name, date, admin_id, plan_type, terms_version, is_demo)
values ('e9000000-0000-0000-0000-000000000000', 'demo-test-2027', 'Démo', current_date - 400,
        'a0000000-0000-0000-0000-00000000000a', 'premium', 'test', true);
select is((select expires_at from public.events where id = 'e9000000-0000-0000-0000-000000000000'), null,
          'la démo n''expire jamais');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$insert into public.photos (event_id, storage_path) values ('e9000000-0000-0000-0000-000000000000', 'e9000000-0000-0000-0000-000000000000/x.jpg')$$,
  'P0001', 'DEMO_READ_ONLY', 'démo : aucun envoi de photo possible');
select is(public.can_upload_photo('e9000000-0000-0000-0000-000000000000/x.jpg'), false, 'démo : aucun fichier stockable');
reset role;

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
insert into public.events (slug, name, date, terms_version, is_demo)
values ('fake-demo-test-2027', 'Fausse démo', current_date + 30, 'test', true);
reset role;
select set_config('request.jwt.claims', '', true);
select is((select is_demo from public.events where slug = 'fake-demo-test-2027'), false,
          'un client ne peut pas marquer son événement comme démo');

select * from finish();
rollback;
