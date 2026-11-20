// Test des emails contre la base LOCALE, sans rien envoyer : le site doit tourner avec
// EMAIL_TRANSPORT=file (emails écrits dans .outbox/), CRON_SECRET=local_cron_secret et
// STRIPE_WEBHOOK_SECRET=whsec_local_smoke_test_secret. Usage : npm run test:emails
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const SITE = process.env.TEST_SITE_URL || 'http://localhost:3100';
const CRON_SECRET = 'local_cron_secret';
const WEBHOOK_SECRET = 'whsec_local_smoke_test_secret';

const env = Object.fromEntries(
  execSync('node node_modules/supabase/dist/supabase.js status -o env', { encoding: 'utf8' })
    .split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]])
);
if (!env.API_URL?.includes('127.0.0.1')) throw new Error('Ce script ne tourne que sur la base locale.');

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(env.API_URL, env.SERVICE_ROLE_KEY, opts);
const stripe = new Stripe('sk_test_signing_only'); // uniquement pour signer les webhooks de test

let failures = 0;
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${!ok && extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
};

const OUTBOX = '.outbox';
const seen = new Set(existsSync(OUTBOX) ? readdirSync(OUTBOX) : []);
function newEmails() {
  if (!existsSync(OUTBOX)) return [];
  const files = readdirSync(OUTBOX).filter((f) => !seen.has(f)).sort();
  files.forEach((f) => seen.add(f));
  return files.map((f) => JSON.parse(readFileSync(`${OUTBOX}/${f}`, 'utf8')));
}

async function newUser() {
  const client = createClient(env.API_URL, env.ANON_KEY, opts);
  const email = `mail-${randomUUID().slice(0, 8)}@test.dev`;
  const { data, error } = await client.auth.signUp({ email, password: 'email-test-123' });
  if (error) throw error;
  return { client, user: data.user, email, token: data.session.access_token };
}

const welcome = (token, eventId) => fetch(`${SITE}/api/emails/welcome`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ eventId }),
});

// ---------------------------------------------------------------------------
// 1. Bienvenue
const alice = await newUser();
const bob = await newUser();
const evilName = `<img src=x onerror=alert(1)> & "Co"`;
const ev = randomUUID();
const slug = `mail-test-2027-${randomUUID().slice(0, 10)}`;
await alice.client.from('events').insert({ id: ev, slug, name: evilName, date: '2027-06-01', admin_id: alice.user.id, terms_version: 'test' });

check((await welcome(null, ev)).status === 401, 'bienvenue : refusé sans connexion');
check((await welcome(bob.token, ev)).status === 404, "bienvenue : impossible d'écrire au sujet de l'événement d'un autre");

const r1 = await welcome(alice.token, ev);
check(r1.ok && (await r1.json()).status === 'sent', 'bienvenue : envoyé');
let mails = newEmails();
check(mails.length === 1 && mails[0].to === alice.email, 'bienvenue : un seul email, adressé au propriétaire', JSON.stringify(mails.map((m) => m.to)));
const w = mails[0];
check(w && !w.html.includes('<img src=x') && w.html.includes('&lt;img src=x'), 'bienvenue : nom d\'événement échappé (pas d\'injection HTML)');
check(w && !/mot de passe\s*:/i.test(w.html + w.text), 'bienvenue : aucun mot de passe dans l\'email');
check(w && w.html.includes(`/admin/${slug}`) && w.html.includes(`/event/${slug}`), 'bienvenue : liens espace admin et invités');

const r2 = await welcome(alice.token, ev);
check(r2.ok && (await r2.json()).status === 'already_sent' && newEmails().length === 0, 'bienvenue : pas de doublon');

// 2. Paiement confirmé + vente parrainée
const pro = await newUser();
await pro.client.from('partners').insert({ first_name: 'Pat', last_name: 'Pro', activity: 'photographer' });
await service.from('partners').update({ status: 'approved' }).eq('user_id', pro.user.id);
const { data: partner } = await service.from('partners').select('referral_code').eq('user_id', pro.user.id).single();

const carol = await newUser();
const refEv = randomUUID();
await carol.client.from('events').insert({
  id: refEv, slug: `mail-ref-2027-${randomUUID().slice(0, 10)}`, name: 'Carol & Dan', date: '2027-07-01',
  admin_id: carol.user.id, ref_code: partner.referral_code, terms_version: 'test',
});
const session = {
  id: `cs_test_${randomUUID()}`, object: 'checkout.session', payment_status: 'paid',
  amount_subtotal: 9900, amount_total: 9900, currency: 'eur', payment_intent: `pi_test_${randomUUID()}`,
  metadata: { event_id: refEv, user_id: carol.user.id, plan_type: 'premium', from_plan: 'discovery' },
};
const payload = JSON.stringify({ id: `evt_${randomUUID()}`, object: 'event', type: 'checkout.session.completed', data: { object: session } });
const sendHook = () => fetch(`${SITE}/api/stripe/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET }) },
  body: payload,
});
check((await sendHook()).ok, 'webhook de paiement accepté');
mails = newEmails();
const pay = mails.find((m) => m.to === carol.email);
const sale = mails.find((m) => m.to === pro.email);
check(pay && /Premium/.test(pay.subject) && pay.html.includes('99 €'), 'paiement : email de confirmation au client (Premium, 99 €)', pay?.subject);
check(pay && pay.html.includes('/live/'), 'paiement Premium : lien du Live Wall inclus');
check(sale && sale.html.includes('19,80'), 'vente parrainée : email au partenaire avec sa commission (19,80 €)', sale?.subject);
await sendHook();
check(newEmails().length === 0, 'webhook reçu deux fois : pas de second email');

// 3. Tâche quotidienne
const cron = (secret) => fetch(`${SITE}/api/cron/daily`, { headers: secret ? { Authorization: `Bearer ${secret}` } : {} });
check((await cron(null)).status === 401, 'cron : refusé sans secret');
check((await cron('mauvais')).status === 401, 'cron : refusé avec un mauvais secret');

const parisDate = (offset) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(Date.now() + offset * 864e5));
const dave = await newUser();
const yEv = randomUUID();       // mariage hier, avec une photo
const xEv = randomUUID();       // Découverte expirant dans moins de 24 h
const emptyEv = randomUUID();   // mariage hier, sans photo
const { error: seedErr } = await service.from('events').insert([
  { id: yEv, slug: `mail-yday-2027-${randomUUID().slice(0, 10)}`, name: 'Hier', date: parisDate(-1), admin_id: dave.user.id, plan_type: 'essential' },
  { id: xEv, slug: `mail-xpir-2027-${randomUUID().slice(0, 10)}`, name: 'Bientôt fermé', date: parisDate(-2), admin_id: dave.user.id, plan_type: 'discovery' },
  { id: emptyEv, slug: `mail-empt-2027-${randomUUID().slice(0, 10)}`, name: 'Sans photo', date: parisDate(-1), admin_id: dave.user.id, plan_type: 'essential' },
]);
check(!seedErr, 'cron : événements de test créés', seedErr?.message);
const { error: photoErr } = await service.from('photos').insert({ event_id: yEv, storage_path: `${yEv}/a.jpg`, status: 'approved' });
check(!photoErr, 'cron : photo de test créée', photoErr?.message);

const c1 = await cron(CRON_SECRET);
const s1 = await c1.json();
check(c1.ok, 'cron : exécuté', JSON.stringify(s1));
mails = newEmails().filter((m) => m.to === dave.email);
check(mails.some((m) => /souvenirs vous attendent/.test(m.subject) && m.html.includes('1 photo')), 'cron : "galerie prête" envoyé le lendemain du mariage');
check(mails.some((m) => /ferme le/.test(m.subject) && m.html.includes('Bientôt fermé')), 'cron : "galerie bientôt fermée" envoyé (Découverte, < 24 h)');
check(!mails.some((m) => m.html.includes('Sans photo')), 'cron : pas de "galerie prête" sans photo');

await cron(CRON_SECRET);
check(newEmails().filter((m) => m.to === dave.email).length === 0, 'cron relancé : aucun doublon');

const { count } = await service.from('email_log').select('id', { count: 'exact', head: true }).in('event_id', [ev, refEv, yEv, xEv]);
check(count === 5, 'journal : 5 emails enregistrés (bienvenue, paiement, parrainage, galerie prête, expiration)', String(count));

console.log(failures ? `\n${failures} échec(s)` : '\nTout est OK');
process.exit(failures ? 1 : 0);
