// Test du parcours de paiement contre la base LOCALE et Stripe en MODE TEST.
// Prérequis : npm run db:start, puis le site lancé avec la base locale et
// STRIPE_WEBHOOK_SECRET=whsec_local_smoke_test_secret (voir supabase/README.md).
// Usage : npm run test:payment
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const SITE = process.env.TEST_SITE_URL || 'http://localhost:3100';
const WEBHOOK_SECRET = 'whsec_local_smoke_test_secret';

const env = Object.fromEntries(
  execSync('node node_modules/supabase/dist/supabase.js status -o env', { encoding: 'utf8' })
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]])
);
if (!env.API_URL?.includes('127.0.0.1')) throw new Error('Ce script ne tourne que sur la base locale.');

const stripeKey = readFileSync('.env.local', 'utf8').match(/^STRIPE_SECRET_KEY=(.*)$/m)?.[1]?.trim();
if (!stripeKey?.startsWith('sk_test_')) throw new Error('Clé Stripe de TEST requise (sk_test_...).');
const stripe = new Stripe(stripeKey);

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, opts);

let failures = 0;
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
};

async function newUser() {
  const client = createClient(env.API_URL, env.ANON_KEY, opts);
  const { data, error } = await client.auth.signUp({ email: `pay-${randomUUID()}@test.dev`, password: 'payment-test-123' });
  if (error) throw error;
  return { client, user: data.user, token: data.session.access_token };
}

async function newEvent(client, userId, refCode = null) {
  const id = randomUUID();
  const { error } = await client.from('events').insert({
    id, slug: `pay-test-2027-${randomUUID().slice(0, 10)}`, name: 'Paiement Test', date: '2027-06-01',
    admin_id: userId, ref_code: refCode, terms_version: 'test',
  });
  if (error) throw error;
  return id;
}

const checkout = (token, body) =>
  fetch(`${SITE}/api/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ immediateExecution: true, ...body }),
  });

async function sendWebhook(type, object, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify({ id: `evt_${randomUUID()}`, object: 'event', type, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return fetch(`${SITE}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
    body: payload,
  });
}

const paidSession = (eventId, userId, planType, amount, fromPlan = 'discovery') => ({
  id: `cs_test_${randomUUID()}`,
  object: 'checkout.session',
  payment_status: 'paid',
  amount_subtotal: amount,
  amount_total: amount,
  currency: 'eur',
  payment_intent: `pi_test_${randomUUID()}`,
  metadata: { event_id: eventId, user_id: userId, plan_type: planType, from_plan: fromPlan },
});

const eventRow = async (id) => (await service.from('events').select('plan_type').eq('id', id).single()).data;
const ordersOf = async (id) => (await service.from('orders').select('*').eq('event_id', id)).data ?? [];

// ---------------------------------------------------------------------------
const alice = await newUser();
const bob = await newUser();
const ev = await newEvent(alice.client, alice.user.id);

// 1. Création de la session de paiement
check((await checkout(null, { eventId: ev, planType: 'premium' })).status === 401, 'checkout refusé sans connexion');
check((await checkout(bob.token, { eventId: ev, planType: 'premium' })).status === 404, 'checkout refusé pour l\'événement d\'un autre');
check((await checkout(alice.token, { eventId: ev, planType: 'discovery' })).status === 400, 'checkout refusé pour un pack invalide');
check((await checkout(alice.token, { eventId: ev, planType: 'premium', immediateExecution: false })).status === 400, "checkout refusé sans demande d'exécution immédiate (droit de rétractation)");

const res = await checkout(alice.token, { eventId: ev, planType: 'premium' });
const body = await res.json();
check(res.ok && body.url?.startsWith('https://checkout.stripe.com/'), 'session Stripe (mode test) créée', JSON.stringify(body));
const sessionId = body.url?.match(/(cs_test_[A-Za-z0-9]+)/)?.[1];
if (sessionId) {
  const s = await stripe.checkout.sessions.retrieve(sessionId);
  check(s.amount_total === 9900 && s.metadata.event_id === ev, 'session : 99 € et événement rattaché');
  check(s.success_url.startsWith(`${SITE}/admin/`), 'session : retour vers l\'espace admin du site (pas vers l\'origine de la requête)');
  const again = await (await checkout(alice.token, { eventId: ev, planType: 'premium' })).json();
  check(again.url === body.url, 'anti double paiement : la session déjà ouverte est réutilisée');
  await stripe.checkout.sessions.expire(sessionId);
  const fresh = await (await checkout(alice.token, { eventId: ev, planType: 'premium' })).json();
  check(fresh.url && fresh.url !== body.url, 'session expirée : une nouvelle session est créée');
  const freshId = fresh.url?.match(/(cs_test_[A-Za-z0-9]+)/)?.[1];
  if (freshId) await stripe.checkout.sessions.expire(freshId);
}
check((await eventRow(ev)).plan_type === 'discovery', 'le pack ne change pas tant que le paiement n\'est pas confirmé');

// 2. Webhook
check((await sendWebhook('checkout.session.completed', paidSession(ev, alice.user.id, 'premium', 9900), 'whsec_mauvais')).status === 400,
  'webhook refusé avec une mauvaise signature');
check((await eventRow(ev)).plan_type === 'discovery', 'faux webhook : aucun effet');

const unpaid = { ...paidSession(ev, alice.user.id, 'premium', 9900), payment_status: 'unpaid' };
await sendWebhook('checkout.session.completed', unpaid);
check((await eventRow(ev)).plan_type === 'discovery', 'paiement différé non encore réglé : pack inchangé');

const essentialSession = paidSession(ev, alice.user.id, 'essential', 5900);
const w1 = await sendWebhook('checkout.session.completed', essentialSession);
check(w1.ok, 'webhook valide accepté', String(w1.status));
check((await eventRow(ev)).plan_type === 'essential', 'paiement confirmé : pack Essentiel activé');
await sendWebhook('checkout.session.completed', essentialSession);
check((await ordersOf(ev)).length === 1, 'webhook reçu deux fois : une seule commande');

// 3. Passage Essentiel -> Premium : on paie la différence
const up = await checkout(alice.token, { eventId: ev, planType: 'premium' });
const upBody = await up.json();
const upId = upBody.url?.match(/(cs_test_[A-Za-z0-9]+)/)?.[1];
if (upId) {
  const s = await stripe.checkout.sessions.retrieve(upId);
  check(s.amount_total === 4000, 'passage Essentiel → Premium : 40 € (différence)', String(s.amount_total));
  await stripe.checkout.sessions.expire(upId);
} else check(false, 'session de passage Premium créée', JSON.stringify(upBody));
check((await checkout(alice.token, { eventId: ev, planType: 'essential' })).status === 409, 'impossible de "racheter" un pack inférieur ou égal');

const premiumSession = paidSession(ev, alice.user.id, 'premium', 4000, 'essential');
await sendWebhook('checkout.session.completed', premiumSession);
check((await eventRow(ev)).plan_type === 'premium', 'paiement confirmé : pack Premium activé');

// 4. Remboursement complet du passage Premium -> retour en Essentiel
await sendWebhook('charge.refunded', { id: `ch_${randomUUID()}`, object: 'charge', refunded: true, payment_intent: premiumSession.payment_intent });
check((await eventRow(ev)).plan_type === 'essential', 'remboursement du passage Premium : retour au pack Essentiel');
check((await ordersOf(ev)).find((o) => o.stripe_session_id === premiumSession.id)?.status === 'refunded', 'commande marquée remboursée');

// 5. Commission partenaire (20 %)
const pro = await newUser();
await pro.client.from('partners').insert({ first_name: 'Pat', last_name: 'Pro', activity: 'photographer' });
await service.from('partners').update({ status: 'approved' }).eq('user_id', pro.user.id);
const { data: partner } = await service.from('partners').select('id, referral_code').eq('user_id', pro.user.id).single();

const carol = await newUser();
const refEv = await newEvent(carol.client, carol.user.id, partner.referral_code.toLowerCase());
await sendWebhook('checkout.session.completed', paidSession(refEv, carol.user.id, 'premium', 9900));
const refOrder = (await ordersOf(refEv))[0];
check(refOrder?.partner_id === partner.id && refOrder?.commission_cents === 1980, 'vente parrainée : commission de 19,80 € pour le partenaire',
  JSON.stringify(refOrder));

const { data: proOrders } = await pro.client.from('orders').select('id, commission_cents');
check(proOrders?.length === 1, 'le partenaire voit uniquement ses ventes parrainées');
const { data: aliceOrders } = await alice.client.from('orders').select('id');
check(aliceOrders?.length === 2, 'le client voit ses propres commandes');

console.log(failures ? `\n${failures} échec(s)` : '\nTout est OK');
process.exit(failures ? 1 : 0);
