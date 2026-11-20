// Développement local uniquement : Stripe ne peut pas joindre le site sur votre PC, donc le
// webhook n'arrive jamais. Ce script récupère les paiements de TEST des dernières 24 h et les
// transmet au webhook local, signés comme le ferait Stripe (équivalent de `stripe listen`).
// Usage : npm run stripe:sync   (avec `npm run dev:local` lancé)
import { testSiteUrl } from './site-url.mjs';
import { readFileSync } from 'node:fs';
import Stripe from 'stripe';

const SITE = testSiteUrl();
const SECRET = 'whsec_local_smoke_test_secret'; // celui utilisé par npm run dev:local

const key = readFileSync('.env.local', 'utf8').match(/^STRIPE_SECRET_KEY=(.*)$/m)?.[1]?.trim();
if (!key?.startsWith('sk_test_')) {
  console.error('Clé Stripe de TEST requise dans .env.local (sk_test_...). Ce script ne doit jamais servir en production.');
  process.exit(1);
}
const stripe = new Stripe(key);

const since = Math.floor(Date.now() / 1000) - 24 * 3600;
const sessions = await stripe.checkout.sessions.list({ limit: 100, created: { gte: since } });
const paid = sessions.data.filter((s) => s.payment_status === 'paid' && s.metadata?.event_id);

if (paid.length === 0) {
  console.log('Aucun paiement de test réussi ces dernières 24 h.');
  process.exit(0);
}

for (const session of paid.reverse()) {
  const payload = JSON.stringify({ id: `evt_local_${session.id}`, object: 'event', type: 'checkout.session.completed', data: { object: session } });
  const res = await fetch(`${SITE}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) },
    body: payload,
  }).catch((err) => ({ ok: false, status: err.message }));
  const when = new Date(session.created * 1000).toLocaleTimeString('fr-FR');
  console.log(`${res.ok ? 'ok  ' : 'FAIL'} ${when} — ${session.amount_total / 100} € — pack ${session.metadata.plan_type} (${res.status})`);
}
console.log('\nTerminé. Les paiements déjà traités sont ignorés (aucun doublon).');
