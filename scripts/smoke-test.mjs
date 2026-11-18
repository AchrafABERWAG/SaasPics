// Test de bout en bout contre la base Supabase LOCALE (npm run db:start), via les vraies API.
// Usage : npm run smoke
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws'; // Node 20 n'a pas de WebSocket intégré (les navigateurs, si)

const env = Object.fromEntries(
  execSync('node node_modules/supabase/dist/supabase.js status -o env', { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]])
);
if (!env.API_URL?.includes('127.0.0.1')) throw new Error('Ce script ne tourne que sur la base locale.');

const opts = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket } };
const admin = createClient(env.API_URL, env.ANON_KEY, opts);
const guest = createClient(env.API_URL, env.ANON_KEY, opts);

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failures++;
};

// Image JPEG minimale valide (1x1)
const jpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

// 1. Compte + événement (modération désactivée)
const email = `smoke-${Date.now()}@test.dev`;
const { data: signUp, error: signUpErr } = await admin.auth.signUp({ email, password: 'smoke-test-123' });
check(!signUpErr && signUp.session, 'création de compte (session ouverte)');

const eventId = randomUUID();
const slug = `smoke-test-2027-${randomUUID().slice(0, 10)}`;
const { data: event, error: evErr } = await admin
  .from('events')
  .insert({ id: eventId, slug, name: 'Smoke Test', date: '2027-06-01', admin_id: signUp.user.id, plan_type: 'premium' })
  .select()
  .single();
check(!evErr && event?.plan_type === 'discovery', 'création d\'événement : pack forcé à discovery');

// 2. Abonnement temps réel du Live Wall
const received = new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), 8000);
  guest
    .channel(`event-photos:${eventId}`)
    .on('broadcast', { event: 'photo' }, ({ payload }) => {
      clearTimeout(timer);
      resolve(payload);
    })
    .subscribe();
});
await new Promise((r) => setTimeout(r, 1500));

// 3. Invité : upload du fichier + enregistrement
const path = `${eventId}/${randomUUID()}.jpg`;
const { error: upErr } = await guest.storage.from('photos').upload(path, jpeg, { contentType: 'image/jpeg' });
check(!upErr, `upload invité via l'API Storage${upErr ? ' — ' + upErr.message : ''}`);

const { error: insErr } = await guest.from('photos').insert({ event_id: eventId, storage_path: path, status: 'rejected' });
check(!insErr, `enregistrement de la photo${insErr ? ' — ' + insErr.message : ''}`);

// 4. Refus attendus
const { error: badPathErr } = await guest.storage.from('photos').upload(`not-an-event/${randomUUID()}.jpg`, jpeg, { contentType: 'image/jpeg' });
check(!!badPathErr, 'upload refusé hors d\'un dossier d\'événement');
const { error: mimeErr } = await guest.storage.from('photos').upload(`${eventId}/${randomUUID()}.html`, Buffer.from('<script>'), { contentType: 'text/html' });
check(!!mimeErr, 'upload refusé pour un fichier non-image');

// 5. Lectures publiques
const { data: pub } = await guest.rpc('get_event_public', { p_slug: slug }).maybeSingle();
check(pub?.id === eventId, 'lecture publique de l\'événement par son slug');
const { data: photos } = await guest.rpc('get_event_photos', { p_event_id: eventId });
check(photos?.length === 1, 'la photo est visible (modération désactivée, statut "rejected" envoyé ignoré)');
const { data: listed } = await guest.from('photos').select('*');
check(Array.isArray(listed) && listed.length === 0, 'un invité ne peut pas lister la table photos');
const publicUrl = `${env.API_URL}/storage/v1/object/public/photos/${path}`;
const res = await fetch(publicUrl);
check(res.ok, 'l\'URL publique de la photo s\'affiche');

// 6. Temps réel
const payload = await received;
check(payload?.storage_path === path && payload?.visible === true, 'le Live Wall reçoit la photo en temps réel');

// 7. Suppression : invité refusé, admin autorisé (via l'API Storage)
await guest.storage.from('photos').remove([path]);
check((await fetch(publicUrl)).ok, 'un invité ne peut pas supprimer le fichier');
const { data: removed, error: rmErr } = await admin.storage.from('photos').remove([path]);
check(!rmErr && removed?.length === 1, `l'admin peut supprimer le fichier${rmErr ? ' — ' + rmErr.message : ''}`);

console.log(failures ? `\n${failures} échec(s)` : '\nTout est OK');
process.exit(failures ? 1 : 0);
