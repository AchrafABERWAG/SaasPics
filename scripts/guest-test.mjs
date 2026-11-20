// Test du parcours invité (miniature, prénom, petit mot, suppression dans les 10 minutes),
// contre la base LOCALE. Le site doit tourner (npm run dev:local).
// Usage : npm run test:guest
import { testSiteUrl } from './site-url.mjs';
import { execSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SITE = testSiteUrl();
const env = Object.fromEntries(
  execSync('node node_modules/supabase/dist/supabase.js status -o env', { encoding: 'utf8' })
    .split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]])
);
if (!env.API_URL?.includes('127.0.0.1')) throw new Error('Ce script ne tourne que sur la base locale.');

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, opts);
const guest = createClient(env.API_URL, env.ANON_KEY, opts);

let failures = 0;
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
};

const jpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

// Un événement de test (pack Découverte, 30 photos) appartenant à un compte jetable.
const owner = createClient(env.API_URL, env.ANON_KEY, opts);
const { data: signUp } = await owner.auth.signUp({ email: `guest-${randomUUID().slice(0, 8)}@test.dev`, password: 'guest-test-123' });
const eventId = randomUUID();
const { error: evErr } = await service.from('events').insert({
  id: eventId, slug: `guest-test-2027-${randomUUID().slice(0, 10)}`, name: 'Invités',
  date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), admin_id: signUp.user.id, plan_type: 'discovery',
});
if (evErr) throw evErr;

// Envoi comme le fait le téléphone de l'invité (src/lib/upload.ts).
async function sendPhoto({ name = null, caption = null } = {}) {
  const id = randomUUID();
  const storagePath = `${eventId}/${id}.jpg`;
  const thumbPath = `${eventId}/${id}.thumb.jpg`;
  const token = randomBytes(24).toString('hex');
  const bucket = guest.storage.from('photos');
  const up1 = await bucket.upload(storagePath, jpeg, { contentType: 'image/jpeg' });
  const up2 = await bucket.upload(thumbPath, jpeg, { contentType: 'image/jpeg' });
  const ins = await guest.from('photos').insert({
    id, event_id: eventId, storage_path: storagePath, thumb_path: thumbPath, guest_name: name, caption, delete_token_hash: token,
  });
  return { id, storagePath, thumbPath, token, error: up1.error || up2.error || ins.error };
}

const deleteOwn = (photoId, token) =>
  fetch(`${SITE}/api/photos/delete-own`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoId, token }),
  });

const files = async () => ((await service.storage.from('photos').list(eventId)).data ?? []).map((f) => f.name);

// 1. Envoi avec miniature, prénom et petit mot
const a = await sendPhoto({ name: 'Mamie', caption: 'Quelle belle journée !' });
check(!a.error, 'invité : photo + miniature + prénom + petit mot envoyés', a.error?.message);
const { data: listed } = await guest.rpc('get_event_photos', { p_event_id: eventId });
const pa = listed?.find((p) => p.id === a.id);
check(pa?.thumb_path === a.thumbPath && pa?.guest_name === 'Mamie' && pa?.caption === 'Quelle belle journée !',
  'galerie : miniature, prénom et petit mot renvoyés', JSON.stringify(pa));
const thumbRes = await fetch(`${env.API_URL}/storage/v1/object/public/photos/${a.thumbPath}`);
check(thumbRes.ok, 'la miniature est accessible publiquement');

// 2. Suppression par l'invité
check((await deleteOwn(a.id, randomBytes(24).toString('hex'))).status === 404, 'suppression refusée avec un mauvais jeton');
check((await deleteOwn(a.id, 'court')).status === 400, 'suppression refusée avec un jeton invalide');
const ok = await deleteOwn(a.id, a.token);
check(ok.ok, 'suppression acceptée avec le bon jeton (moins de 10 min)', String(ok.status));
const { data: row } = await service.from('photos').select('id').eq('id', a.id).maybeSingle();
check(!row, 'la photo est retirée de la base');
const left = await files();
check(!left.includes(a.storagePath.split('/')[1]) && !left.includes(a.thumbPath.split('/')[1]), 'photo et miniature supprimées du stockage', left.join(','));
check((await deleteOwn(a.id, a.token)).status === 404, 'jeton inutilisable une seconde fois');

// 3. Au-delà de 10 minutes : seuls les mariés peuvent retirer la photo
const b = await sendPhoto();
await service.from('photos').update({ created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString() }).eq('id', b.id);
check((await deleteOwn(b.id, b.token)).status === 403, 'après 10 minutes : suppression par l’invité refusée');

// 4. Pack Découverte : les miniatures ne comptent pas dans les 30 photos
for (let i = 0; i < 28; i++) {
  const r = await sendPhoto();
  if (r.error) { check(false, `photo ${i + 2}/30 acceptée`, r.error.message); break; }
}
const { count } = await service.from('photos').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
check(count === 29, '29 photos (et 29 miniatures) enregistrées', String(count));
const last = await sendPhoto();
check(!last.error, '30e photo acceptée malgré 58 fichiers déjà stockés', last.error?.message);
const over = await sendPhoto();
check(!!over.error, '31e photo refusée (limite du pack Découverte)');

// Ménage
await service.storage.from('photos').remove((await files()).map((n) => `${eventId}/${n}`));
await service.from('events').delete().eq('id', eventId);
await service.auth.admin.deleteUser(signUp.user.id);

console.log(failures ? `\n${failures} échec(s)` : '\nTout est OK');
process.exit(failures ? 1 : 0);
