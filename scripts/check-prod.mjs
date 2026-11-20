// Vérifie la configuration de PRODUCTION avant la mise en ligne.
// Usage : npm run check:prod -- <fichier .env>      (par défaut : .env.production.local)
//         npm run check:prod -- <fichier> --offline  (sans appeler Supabase / Stripe / Resend)
// Le fichier contient les mêmes variables que celles saisies chez l'hébergeur (voir .env.example).
// Rien n'est modifié : le script ne fait que lire.
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const args = process.argv.slice(2);
const offline = args.includes('--offline');
const file = args.find((a) => !a.startsWith('--')) || '.env.production.local';

if (!existsSync(file)) {
  console.error(`Fichier ${file} introuvable. Créez-le à partir de .env.example avec les valeurs de production.`);
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^(["'])(.*)\1$/, '$2')])
);

let blocking = 0;
let warnings = 0;
const ok = (label) => console.log(`ok    ${label}`);
const fail = (label, hint) => { blocking++; console.log(`BLOQUANT  ${label}${hint ? `\n          → ${hint}` : ''}`); };
const warn = (label, hint) => { warnings++; console.log(`à voir  ${label}${hint ? `\n          → ${hint}` : ''}`); };
const check = (cond, label, hint) => (cond ? ok(label) : fail(label, hint));

const jwtRole = (token) => {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role; } catch { return null; }
};

console.log(`Configuration lue dans ${file}\n`);

// --- Site ----------------------------------------------------------------------------------------
const site = env.NEXT_PUBLIC_SITE_URL ?? '';
check(/^https:\/\/[^/]+[^/]$/.test(site) && !/localhost|127\.0\.0\.1|192\.168\./.test(site),
  `NEXT_PUBLIC_SITE_URL en https sur le vrai domaine (${site || 'vide'})`, 'ex: https://www.mon-domaine.fr, sans slash final');

// --- Supabase ------------------------------------------------------------------------------------
const sbUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
check(/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(sbUrl), 'NEXT_PUBLIC_SUPABASE_URL = projet Supabase hébergé');
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
check(jwtRole(anon) === 'anon' || anon.startsWith('sb_publishable_'), 'NEXT_PUBLIC_SUPABASE_ANON_KEY = clé publique (anon)');
const service = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
check(jwtRole(service) === 'service_role' || service.startsWith('sb_secret_'), 'SUPABASE_SERVICE_ROLE_KEY = clé serveur (service_role)',
  'Project Settings → API → service_role. Ne jamais la mettre dans une variable NEXT_PUBLIC_.');
for (const [k, v] of Object.entries(env)) {
  if (k.startsWith('NEXT_PUBLIC_') && (jwtRole(v) === 'service_role' || /^(sk_|sb_secret_|re_|whsec_)/.test(v))) {
    fail(`${k} contient un secret visible dans le navigateur`, 'Retirer immédiatement et régénérer la clé.');
  }
}

// --- Stripe --------------------------------------------------------------------------------------
const sk = env.STRIPE_SECRET_KEY ?? '';
if (sk.startsWith('sk_live_') || sk.startsWith('rk_live_')) ok('STRIPE_SECRET_KEY en mode réel (live)');
else if (sk.startsWith('sk_test_')) warn('STRIPE_SECRET_KEY en mode TEST : aucun vrai paiement ne sera encaissé', 'Passer à la clé sk_live_ le jour de l’ouverture des ventes.');
else fail('STRIPE_SECRET_KEY absente ou invalide');
const whsec = env.STRIPE_WEBHOOK_SECRET ?? '';
check(whsec.startsWith('whsec_') && whsec !== 'whsec_local_smoke_test_secret', 'STRIPE_WEBHOOK_SECRET du point de terminaison de production',
  'Stripe → Developers → Webhooks → votre endpoint → Signing secret');
if (env.STRIPE_AUTOMATIC_TAX !== 'true') warn('STRIPE_AUTOMATIC_TAX désactivé', 'Normal en micro-entreprise en franchise de TVA ; sinon activer Stripe Tax.');

// --- Emails --------------------------------------------------------------------------------------
check((env.RESEND_API_KEY ?? '').startsWith('re_'), 'RESEND_API_KEY présente');
const from = env.EMAIL_FROM ?? '';
check(/@/.test(from) && !/mon-domaine|example|test\.dev/.test(from), `EMAIL_FROM sur votre domaine (${from || 'vide'})`, 'Le domaine doit être vérifié dans Resend.');
check(!env.EMAIL_TRANSPORT || env.EMAIL_TRANSPORT === 'resend', 'EMAIL_TRANSPORT = resend (ou vide)', '"file" et "log" n’envoient aucun email.');
check(/@/.test(env.ADMIN_NOTIFICATION_EMAIL ?? ''), 'ADMIN_NOTIFICATION_EMAIL (candidatures Pro, signalements)');

// --- Cron ----------------------------------------------------------------------------------------
const cron = env.CRON_SECRET ?? '';
check(cron.length >= 32 && cron !== 'local_cron_secret', 'CRON_SECRET aléatoire (32 caractères minimum)',
  'ex: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
if (env.DEV_ALLOWED_ORIGINS) warn('DEV_ALLOWED_ORIGINS défini : inutile en production');

// --- Mentions légales ----------------------------------------------------------------------------
const legal = readFileSync('src/lib/legal.ts', 'utf8');
const missing = [...legal.matchAll(/'\[À COMPLÉTER : ([^\]]+)\]'/g)].map((m) => m[1]);
check(missing.length === 0, 'Mentions légales complètes (src/lib/legal.ts)',
  missing.length ? `Reste à compléter : ${missing.join(' ; ')}` : undefined);

// --- Vérifications en ligne ----------------------------------------------------------------------
if (!offline) {
  console.log('\nVérifications en ligne…');
  if (/^https:\/\//.test(sbUrl) && service) {
    const db = createClient(sbUrl, service, { auth: { persistSession: false } });
    const tables = ['events', 'photos', 'orders', 'partners', 'email_log', 'photo_reports', 'checkout_sessions', 'rate_limits'];
    for (const t of tables) {
      const { error } = await db.from(t).select('*', { head: true, count: 'exact' });
      check(!error, `Supabase : table ${t}`, error ? `${error.message} → exécuter les migrations 0001 à 0009 dans l’ordre` : undefined);
    }
    const { data: demo } = await db.from('events').select('id').eq('slug', 'demo-mariage').eq('is_demo', true).maybeSingle();
    if (!demo) warn('Événement de démonstration absent : le bouton « Voir la démo » de l’accueil mène à une page vide', 'npm run demo:create -- <fichier .env>');
    const { data: buckets } = await db.storage.listBuckets();
    check(buckets?.some((b) => b.id === 'photos' && b.public), 'Supabase : bucket photos public');
  }
  if (sk.startsWith('sk_') || sk.startsWith('rk_')) {
    try {
      const stripe = new Stripe(sk);
      const account = await stripe.accounts.retrieve();
      check(account.charges_enabled, `Stripe : compte ${account.id} autorisé à encaisser`, 'Terminer l’activation du compte dans le Dashboard Stripe.');
      const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
      const target = `${site}/api/stripe/webhook`;
      const ep = endpoints.data.find((e) => e.url === target);
      if (!ep) fail(`Stripe : webhook vers ${target}`, 'Developers → Webhooks → Add endpoint');
      else {
        const needed = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'charge.refunded'];
        const lacking = ep.enabled_events.includes('*') ? [] : needed.filter((e) => !ep.enabled_events.includes(e));
        check(ep.status === 'enabled' && lacking.length === 0, `Stripe : webhook actif avec les bons événements`,
          lacking.length ? `Événements manquants : ${lacking.join(', ')}` : 'Endpoint désactivé');
      }
    } catch (err) {
      fail('Stripe : clé refusée', err.message);
    }
  }
  if ((env.RESEND_API_KEY ?? '').startsWith('re_')) {
    const res = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } });
    const restricted = !res.ok && (await res.clone().json().catch(() => ({}))).name === 'restricted_api_key';
    if (restricted) warn('Resend : clé limitée à l’envoi (recommandé) : domaine non vérifiable ici', 'Vérifier dans Resend → Domains que le domaine est « Verified ».');
    else if (!res.ok) fail('Resend : clé refusée', `HTTP ${res.status}`);
    else {
      const domain = from.match(/@([^>\s]+)/)?.[1];
      const { data } = await res.json();
      const d = data?.find((x) => x.name === domain);
      check(d?.status === 'verified', `Resend : domaine ${domain} vérifié`, 'Ajouter les enregistrements DNS indiqués par Resend.');
    }
  }
}

console.log(`\n${blocking} point(s) bloquant(s), ${warnings} point(s) à vérifier.`);
process.exit(blocking ? 1 : 0);
