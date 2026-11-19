// Test des aspects légaux (CGV, rétractation, signalement, suppression) contre la base LOCALE.
// Le site doit tourner avec EMAIL_TRANSPORT=file, ADMIN_NOTIFICATION_EMAIL=equipe@test.dev,
// STRIPE_WEBHOOK_SECRET=whsec_local_smoke_test_secret. Usage : npm run test:legal
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const SITE = process.env.TEST_SITE_URL || 'http://localhost:3100';
const env = Object.fromEntries(
  execSync('node node_modules/supabase/dist/supabase.js status -o env', { encoding: 'utf8' })
    .split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]])
);
if (!env.API_URL?.includes('127.0.0.1')) throw new Error('Ce script ne tourne que sur la base locale.');

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, opts);
const guest = createClient(env.API_URL, env.ANON_KEY, opts);
const stripe = new Stripe('sk_test_signing_only');

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
  const email = `legal-${randomUUID().slice(0, 8)}@test.dev`;
  const { data, error } = await client.auth.signUp({ email, password: 'legal-test-123' });
  if (error) throw error;
  return { client, user: data.user, email, token: data.session.access_token };
}
const post = (path, body, token) => fetch(`${SITE}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
const jpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);
async function eventWithPhoto(owner, status = 'approved') {
  const id = randomUUID();
  const { error } = await owner.client.from('events').insert({
    id, slug: `legal-test-2027-${randomUUID().slice(0, 10)}`, name: 'Légal', date: '2027-09-01', admin_id: owner.user.id, terms_version: 'test',
  });
  if (error) throw error;
  const path = `${id}/${randomUUID()}.jpg`;
  await guest.storage.from('photos').upload(path, jpeg, { contentType: 'image/jpeg' });
  await service.from('photos').insert({ event_id: id, storage_path: path, status });
  const { data: photo } = await service.from('photos').select('id').eq('storage_path', path).single();
  return { id, path, photoId: photo.id };
}
const fileExists = async (path) => (await fetch(`${env.API_URL}/storage/v1/object/public/photos/${path}`)).ok;

// 1. Pages légales
for (const [path, title] of [['/mentions-legales', 'Mentions légales'], ['/cgv', 'Conditions générales'], ['/confidentialite', 'Politique de confidentialité']]) {
  const res = await fetch(`${SITE}${path}`);
  check(res.ok && (await res.text()).includes(title), `page ${path} accessible`);
}

// 2. CGV obligatoires à la création
const alice = await newUser();
const { error: noTerms } = await alice.client.from('events').insert({ slug: `legal-noterms-2027-${randomUUID().slice(0, 8)}`, name: 'X', date: '2027-09-01', admin_id: alice.user.id });
check(noTerms?.message?.includes('TERMS_REQUIRED'), 'création refusée sans acceptation des CGV');
const ev = await eventWithPhoto(alice);
const { data: evRow } = await service.from('events').select('terms_version, terms_accepted_at').eq('id', ev.id).single();
check(evRow?.terms_version === 'test' && !!evRow?.terms_accepted_at, 'version et date d\'acceptation des CGV enregistrées');

// 3. Demande d'exécution immédiate enregistrée sur la commande
const session = {
  id: `cs_test_${randomUUID()}`, object: 'checkout.session', payment_status: 'paid', amount_subtotal: 5900, amount_total: 5900,
  currency: 'eur', payment_intent: `pi_test_${randomUUID()}`,
  metadata: { event_id: ev.id, user_id: alice.user.id, plan_type: 'essential', from_plan: 'discovery', immediate_execution: 'true' },
};
const payload = JSON.stringify({ id: `evt_${randomUUID()}`, object: 'event', type: 'checkout.session.completed', data: { object: session } });
await fetch(`${SITE}/api/stripe/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_smoke_test_secret' }) },
  body: payload,
});
const { data: order } = await service.from('orders').select('id, immediate_execution_requested').eq('stripe_session_id', session.id).single();
check(order?.immediate_execution_requested === true, 'commande : demande d\'exécution immédiate enregistrée (preuve pour le droit de rétractation)');
newEmails();

// 4. Signalement de photo
check((await post('/api/photos/report', { photoId: 'pas-un-id', reason: 'x' })).status === 400, 'signalement : requête invalide refusée');
const pendingEv = await eventWithPhoto(alice, 'pending');
check((await post('/api/photos/report', { photoId: pendingEv.photoId, reason: 'x' })).status === 404, 'signalement : impossible sur une photo non publiée');

const r1 = await post('/api/photos/report', { photoId: ev.photoId, reason: 'Je suis sur cette photo <script>' });
check(r1.ok, 'signalement d\'une photo publiée accepté');
let mails = newEmails();
const ownerMail = mails.find((m) => m.to === alice.email);
check(ownerMail && ownerMail.html.includes('&lt;script&gt;'), 'organisateur prévenu (motif échappé)');
check(mails.some((m) => m.to === 'equipe@test.dev'), 'équipe prévenue du signalement');
await post('/api/photos/report', { photoId: ev.photoId, reason: 'encore' });
check(newEmails().length === 0, 'second signalement : pas de nouvel email');
const { count: reports } = await service.from('photo_reports').select('id', { count: 'exact', head: true }).eq('photo_id', ev.photoId);
check(reports === 2, 'signalements enregistrés', String(reports));
const { data: guestReports } = await guest.from('photo_reports').select('id');
check((guestReports ?? []).length === 0, 'un invité ne peut pas lire les signalements');
const { data: ownerReports } = await alice.client.from('photo_reports').select('id').eq('event_id', ev.id);
check(ownerReports?.length === 2, 'l\'organisateur voit les signalements de son événement');

// 5. Suppression d'un événement
const bob = await newUser();
check((await post('/api/events/delete', { eventId: ev.id }, bob.token)).status === 404, 'suppression : impossible pour l\'événement d\'un autre');
check((await post('/api/events/delete', { eventId: ev.id }, alice.token)).ok, 'suppression d\'événement par son propriétaire');
const { data: gone } = await service.from('events').select('id').eq('id', ev.id).maybeSingle();
check(!gone && !(await fileExists(ev.path)), 'événement et fichiers supprimés');
const { data: keptOrder } = await service.from('orders').select('event_id').eq('id', order.id).single();
check(keptOrder && keptOrder.event_id === null, 'commande conservée (comptabilité), détachée de l\'événement');

// 6. Suppression du compte
check((await post('/api/account/delete', {}, alice.token)).status === 400, 'suppression du compte : confirmation exigée');
check((await post('/api/account/delete', { confirm: 'SUPPRIMER' }, alice.token)).ok, 'suppression du compte');
const { data: userAfter } = await service.auth.admin.getUserById(alice.user.id);
check(!userAfter?.user, 'compte supprimé');
const { data: leftEvents } = await service.from('events').select('id').eq('admin_id', alice.user.id);
check((leftEvents ?? []).length === 0 && !(await fileExists(pendingEv.path)), 'tous ses événements et fichiers supprimés');
const { data: orderAfter } = await service.from('orders').select('user_id').eq('id', order.id).single();
check(orderAfter && orderAfter.user_id === null, 'commande conservée, détachée du compte');

console.log(failures ? `\n${failures} échec(s)` : '\nTout est OK');
process.exit(failures ? 1 : 0);
