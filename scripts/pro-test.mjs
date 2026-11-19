// Test de la section Pro, de l'espace "Mes événements" et de la gestion des photos, contre la base LOCALE.
// Le site doit tourner avec EMAIL_TRANSPORT=file, CRON_SECRET=local_cron_secret,
// ADMIN_NOTIFICATION_EMAIL=equipe@test.dev. Usage : npm run test:pro
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SITE = process.env.TEST_SITE_URL || 'http://localhost:3100';
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

const seen = new Set(existsSync('.outbox') ? readdirSync('.outbox') : []);
function newEmails() {
  if (!existsSync('.outbox')) return [];
  const files = readdirSync('.outbox').filter((f) => !seen.has(f)).sort();
  files.forEach((f) => seen.add(f));
  return files.map((f) => JSON.parse(readFileSync(`.outbox/${f}`, 'utf8')));
}

async function newUser() {
  const client = createClient(env.API_URL, env.ANON_KEY, opts);
  const email = `pro-${randomUUID().slice(0, 8)}@test.dev`;
  const { data, error } = await client.auth.signUp({ email, password: 'pro-test-123' });
  if (error) throw error;
  return { client, user: data.user, email, token: data.session.access_token };
}
const jpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);
const notify = (token) => fetch(`${SITE}/api/partners/notify`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
const cron = () => fetch(`${SITE}/api/cron/daily`, { headers: { Authorization: 'Bearer local_cron_secret' } }).then((r) => r.json());

// ---------------------------------------------------------------------------
// 1. Candidature partenaire
const pro = await newUser();
check((await notify(null)).status === 401, 'notification candidature : refusée sans connexion');

const { error: appErr } = await pro.client.from('partners').insert({
  first_name: 'Sophie', last_name: '<b>Martin</b>', company: 'Sophie Wedding', activity: 'wedding_planner',
  website: 'sophie.example', weddings_per_year: '10-30',
});
check(!appErr, 'candidature enregistrée', appErr?.message);

const n1 = await (await notify(pro.token)).json();
let mails = newEmails();
const appMail = mails.find((m) => m.to === 'equipe@test.dev');
check(n1.status === 'sent' && appMail, 'équipe prévenue de la candidature', JSON.stringify(n1));
check(appMail && appMail.html.includes(pro.email) && appMail.html.includes('&lt;b&gt;Martin'), 'email candidature : infos du partenaire, échappées');
check((await (await notify(pro.token)).json()).status === 'already_sent' && newEmails().length === 0, 'candidature : pas de second email');

// 2. Validation par l'équipe -> email au partenaire (tâche quotidienne)
await service.from('partners').update({ status: 'approved' }).eq('user_id', pro.user.id);
const s1 = await cron();
mails = newEmails().filter((m) => m.to === pro.email);
const { data: partner } = await service.from('partners').select('id, referral_code').eq('user_id', pro.user.id).single();
check(s1.partners_approved >= 1 && mails.length === 1 && mails[0].html.includes(partner.referral_code), 'partenaire validé : email avec son code de parrainage', JSON.stringify(s1));
await cron();
check(newEmails().filter((m) => m.to === pro.email).length === 0, 'validation : pas de second email');

// 3. Lien partenaire : l'événement d'un client est rattaché, et le partenaire voit la vente
const client = await newUser();
const evId = randomUUID();
const slug = `pro-test-2027-${randomUUID().slice(0, 10)}`;
await client.client.from('events').insert({ id: evId, slug, name: 'Client Pro', date: '2027-08-01', admin_id: client.user.id, ref_code: partner.referral_code });
const { data: ev } = await service.from('events').select('referred_by').eq('id', evId).single();
check(ev?.referred_by === partner.id, 'événement créé avec le lien partenaire : rattaché au partenaire');

// 4. "Mes événements" : chacun ne voit que les siens
const other = await newUser();
await other.client.from('events').insert({ id: randomUUID(), slug: `pro-other-2027-${randomUUID().slice(0, 10)}`, name: 'Autre', date: '2027-08-02', admin_id: other.user.id });
const { data: mine } = await client.client.from('events').select('id');
check(mine?.length === 1 && mine[0].id === evId, 'Mes événements : uniquement ses propres événements');

// 5. Onglet Photos : l'admin supprime, les autres non
const path = `${evId}/${randomUUID()}.jpg`;
await guest.storage.from('photos').upload(path, jpeg, { contentType: 'image/jpeg' });
await guest.from('photos').insert({ event_id: evId, storage_path: path });
const { data: listed } = await client.client.from('photos').select('id, storage_path').eq('event_id', evId);
check(listed?.length === 1, 'onglet Photos : l\'admin voit les photos de son événement');

await other.client.from('photos').delete().eq('event_id', evId);
await other.client.storage.from('photos').remove([path]);
const { count: still } = await service.from('photos').select('id', { count: 'exact', head: true }).eq('event_id', evId);
check(still === 1 && (await fetch(`${env.API_URL}/storage/v1/object/public/photos/${path}`)).ok, 'un autre utilisateur ne peut pas supprimer ces photos');

const { error: rmErr } = await client.client.storage.from('photos').remove([path]);
const { error: delErr } = await client.client.from('photos').delete().in('id', listed.map((p) => p.id));
const { count: after } = await service.from('photos').select('id', { count: 'exact', head: true }).eq('event_id', evId);
check(!rmErr && !delErr && after === 0 && !(await fetch(`${env.API_URL}/storage/v1/object/public/photos/${path}`)).ok,
  'onglet Photos : l\'admin supprime fichier et photo');

// 6. Galerie invités : pagination
for (let i = 0; i < 3; i++) {
  await service.from('photos').insert({ event_id: evId, storage_path: `${evId}/g${i}.jpg`, status: 'approved', created_at: new Date(Date.now() - i * 1000).toISOString() });
}
const { data: page1 } = await guest.rpc('get_event_photos', { p_event_id: evId, p_limit: 2 });
const { data: page2 } = await guest.rpc('get_event_photos', { p_event_id: evId, p_limit: 2, p_before: page1[1].created_at });
check(page1.length === 2 && page2.length === 1 && !page2.some((p) => page1.some((q) => q.id === p.id)), 'galerie invités : pagination sans doublon');

console.log(failures ? `\n${failures} échec(s)` : '\nTout est OK');
process.exit(failures ? 1 : 0);
