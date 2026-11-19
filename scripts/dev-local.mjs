// Lance le site en local, branché sur la base Supabase LOCALE (Docker), sans modifier .env.local.
// Prérequis : Docker Desktop lancé, puis `npm run db:start`.
// Usage : npm run dev:local   (puis ouvrir http://localhost:3001)
// Les emails ne partent pas : ils sont écrits dans .outbox/. Stripe utilise la clé de test de .env.local.
import { execSync, spawn } from 'node:child_process';

const PORT = process.env.PORT || '3001';

let status;
try {
  status = execSync('node node_modules/supabase/dist/supabase.js status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch {
  console.error('La base locale ne tourne pas. Lancez Docker Desktop puis : npm run db:start');
  process.exit(1);
}
const local = Object.fromEntries(
  status.split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]])
);

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
  STRIPE_WEBHOOK_SECRET: 'whsec_local_smoke_test_secret',
  EMAIL_TRANSPORT: 'file',
  CRON_SECRET: 'local_cron_secret',
  ADMIN_NOTIFICATION_EMAIL: 'equipe@test.dev',
};

console.log(`Site local : http://localhost:${PORT}  (base Supabase locale, emails dans .outbox/)`);
const child = spawn('npx', ['next', 'dev', '-p', PORT], { env, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
