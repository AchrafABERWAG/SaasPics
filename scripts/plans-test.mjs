// Test des limites de packs et de la suppression des galeries expirées, contre la base LOCALE.
// Le site doit tourner avec CRON_SECRET=local_cron_secret et EMAIL_TRANSPORT=file.
// Usage : npm run test:plans
import { testSiteUrl } from './site-url.mjs';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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
const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

const owner = createClient(env.API_URL, env.ANON_KEY, opts);
const { data: signUp } = await owner.auth.signUp({ email: `plans-${randomUUID().slice(0, 8)}@test.dev`, password: 'plans-test-123' });
const token = signUp.session.access_token;

async function eventWithPhotos(date, photos) {
  const id = randomUUID();
  const slug = `plans-test-2027-${randomUUID().slice(0, 10)}`;
  const { error } = await service.from('events').insert({ id, slug, name: 'Plans', date, admin_id: signUp.user.id, plan_type: 'discovery' });
  if (error) throw error;
  for (let i = 0; i < photos; i++) {
    const path = `${id}/${randomUUID()}.jpg`;
    const up = await service.storage.from('photos').upload(path, jpeg, { contentType: 'image/jpeg' });
    if (up.error) throw up.error;
    const ins = await service.from('photos').insert({ event_id: id, storage_path: path, status: 'approved' });
    if (ins.error) throw ins.error;
  }
  return { id, slug };
}
const fileCount = async (id) => (await service.storage.from('photos').list(id, { limit: 100 })).data?.length ?? -1;
const rowCount = async (id) => (await service.from('photos').select('id', { count: 'exact', head: true }).eq('event_id', id)).count;

// Compteur public
const counted = await eventWithPhotos(day(10), 2);
const { data: pub } = await guest.rpc('get_event_public', { p_slug: counted.slug }).maybeSingle();
check(pub?.photo_count === 2 && pub?.max_photos === 30, 'compteur public : 2 / 30 photos', JSON.stringify(pub));

// Galerie fermée depuis plus de 7 jours (Découverte : J+2, jour J il y a 20 jours)
const old = await eventWithPhotos(day(-20), 3);
// Galerie fermée mais encore dans le délai de grâce (jour J il y a 5 jours)
const recent = await eventWithPhotos(day(-5), 2);

check((await fileCount(old.id)) === 3 && (await fileCount(recent.id)) === 2, 'préparation : fichiers présents');

const res = await fetch(`${SITE}/api/cron/daily`, { headers: { Authorization: 'Bearer local_cron_secret' } });
const summary = await res.json();
check(res.ok && summary.purged_events >= 1 && summary.errors === 0, 'cron : suppression exécutée sans erreur', JSON.stringify(summary));

check((await fileCount(old.id)) === 0, 'galerie expirée depuis > 7 jours : fichiers supprimés');
check((await rowCount(old.id)) === 0, 'galerie expirée depuis > 7 jours : photos supprimées de la base');
const { data: oldEv } = await service.from('events').select('purged_at').eq('id', old.id).single();
check(!!oldEv?.purged_at, 'événement conservé et marqué comme purgé');

check((await fileCount(recent.id)) === 2 && (await rowCount(recent.id)) === 2, 'délai de grâce : rien n\'est supprimé avant 7 jours');
check((await fileCount(counted.id)) === 2, 'galerie active : rien n\'est supprimé');

// Paiement impossible après suppression
const pay = await fetch(`${SITE}/api/checkout`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ eventId: old.id, planType: 'premium', immediateExecution: true }),
});
check(pay.status === 410, 'paiement refusé pour un événement dont les photos ont été supprimées', String(pay.status));

// Récupération possible pendant le délai de grâce : le paiement rouvre la galerie
const payRecent = await fetch(`${SITE}/api/checkout`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ eventId: recent.id, planType: 'essential', immediateExecution: true }),
});
check(payRecent.ok, 'délai de grâce : le client peut encore payer pour récupérer ses photos', String(payRecent.status));

// Relancer le cron ne repurge pas
const again = await (await fetch(`${SITE}/api/cron/daily`, { headers: { Authorization: 'Bearer local_cron_secret' } })).json();
const { data: stillPurged } = await service.rpc('events_to_purge', { p_limit: 500 });
check(!(stillPurged ?? []).some((e) => e.id === old.id) && again.errors === 0, 'un événement déjà purgé n\'est plus traité');

console.log(failures ? `\n${failures} échec(s)` : '\nTout est OK');
process.exit(failures ? 1 : 0);
