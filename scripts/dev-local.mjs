// Lance le site en local, branché sur la base Supabase LOCALE (Docker), sans modifier .env.local.
// Le site et la base sont exposés sur l'adresse du PC dans le réseau local : un téléphone
// connecté au même Wi-Fi peut scanner les QR codes et envoyer des photos.
// Prérequis : Docker Desktop lancé, puis `npm run db:start`.
// Usage : npm run dev:local        (adresse détectée automatiquement)
//         LAN_IP=192.168.1.20 npm run dev:local   (pour forcer l'adresse)
// Les emails ne partent pas : ils sont écrits dans .outbox/. Stripe utilise la clé de test de .env.local.
import { execSync, spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { writeFileSync } from 'node:fs';

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

// Adresse IPv4 du PC sur le réseau local (Wi-Fi / Ethernet), en ignorant les cartes virtuelles
// (WSL, Hyper-V, Docker, partage de connexion 192.168.137.x).
function lanIp() {
  if (process.env.LAN_IP) return process.env.LAN_IP;
  const candidates = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    if (/vEthernet|WSL|Docker|Loopback|VirtualBox|VMware|Hyper-V/i.test(name)) continue;
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (a.address.startsWith('192.168.137.') || a.address.startsWith('169.254.')) continue;
      candidates.push(a.address);
    }
  }
  return candidates.find((ip) => ip.startsWith('192.168.')) ?? candidates[0] ?? 'localhost';
}

const ip = lanIp();
const apiUrl = local.API_URL.replace('127.0.0.1', ip);
const siteUrl = `http://${ip}:${PORT}`;
writeFileSync('.dev-local-url', siteUrl); // lu par les scripts de test (scripts/site-url.mjs)

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: siteUrl,
  DEV_ALLOWED_ORIGINS: ip,
  STRIPE_WEBHOOK_SECRET: 'whsec_local_smoke_test_secret',
  EMAIL_TRANSPORT: 'file',
  CRON_SECRET: 'local_cron_secret',
  ADMIN_NOTIFICATION_EMAIL: 'equipe@test.dev',
};

console.log(`\nSite local : ${siteUrl}`);
console.log('Ouvrez cette adresse sur le PC ET sur le téléphone (même Wi-Fi). Les QR codes y renvoient.');
console.log('Si Windows demande d’autoriser Node.js ou Docker sur le réseau privé : acceptez.\n');
const child = spawn('npx', ['next', 'dev', '-p', PORT], { env, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
