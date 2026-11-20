// Crée (ou recrée) l'événement de démonstration : un mariage fictif, pack Premium, avec des
// photos, des prénoms, des petits mots et un défi en cours. Toujours en ligne, en lecture seule
// pour les visiteurs (migration 0009). Photos : Unsplash (licence Unsplash, usage commercial libre).
//
// Usage : npm run demo:create                          → base locale (Docker)
//         npm run demo:create -- .env.production.local → base de production (clé service_role)
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const DEMO_SLUG = 'demo-mariage'; // garder identique à src/lib/demo.ts
const OWNER_EMAIL = 'demo-owner@demo.invalid'; // compte technique, sans mot de passe : personne ne s'y connecte

// [identifiant Unsplash, prénom de l'invité, petit mot] — de la plus ancienne à la plus récente.
// (Contenu vérifié visuellement : chaque légende correspond à sa photo.)
const PHOTOS = [
  ['1469371670807-013ccf25f16a', 'Chloé', 'La cérémonie était magique'],           // allée fleurie
  ['1523438885200-e635ba2c371e', null, null],                                        // kiosque de cérémonie
  ['1522673607200-164d1b6ce486', 'Léa', 'Les chaises des mariés 💕'],               // deux chaises dans l'herbe
  ['1529636798458-92182e662485', 'Antoine', 'Quel décor !'],                         // arche fleurie
  ['1465495976277-4387d4b0b4c6', 'Mamie Jo', 'Tous nos vœux de bonheur, mes chéris'], // alliances
  ['1520854221256-17451cc331bf', 'Nadia', 'Main dans la main'],                      // mains enlacées
  ['1460978812857-470ed1c77af0', null, null],                                        // baiser en noir et blanc
  ['1583939003579-730e3918a45a', 'Inès', 'La sortie sous les pétales !'],            // sortie, pétales
  ['1525258946800-98cfd641d0de', 'Sarah', 'Le bouquet était sublime'],               // bouquet
  ['1507504031003-b417219a0fde', null, 'Mr & Mrs'],                                  // panneau Mr & Mrs
  ['1511795409834-ef04bbd61622', 'Paul', 'Les tables étaient magnifiques'],          // table fleurie
  ['1519225421980-715cb0215aed', null, null],                                        // décoration de table
  ['1527529482837-4698179dc6ce', 'Hugo', 'Santé aux mariés !'],                      // toast au champagne
  ['1532712938310-34cb3982ef74', 'Marc', 'La balade avant le dîner'],                // couple dans les collines
  ['1546032996-6dfacbacbf3f', null, null],                                           // sous le voile
  ['1537633552985-df8429e8048b', 'Julie', 'Trop beaux 😍'],                          // voile sur la plage
  ['1544078751-58fee2d8a03b', null, null],                                           // plage de sable noir
  ['1606216794074-735e91aa2c92', 'Emma', 'Mes deux amoureux préférés'],              // couple sous les palmiers
  ['1591604466107-ec97de577aff', 'Thomas', 'Les plus beaux ❤️'],                    // couple et bouquet
];

// --- Connexion : base locale, ou fichier .env de production ------------------------------------
function loadEnv() {
  const file = process.argv[2];
  if (file) {
    if (!existsSync(file)) throw new Error(`Fichier ${file} introuvable.`);
    const env = Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^(["'])(.*)\1$/, '$2')]));
    return { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY, site: env.NEXT_PUBLIC_SITE_URL };
  }
  const env = Object.fromEntries(execSync('node node_modules/supabase/dist/supabase.js status -o env', { encoding: 'utf8' })
    .split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  const site = existsSync('.dev-local-url') ? readFileSync('.dev-local-url', 'utf8').trim() : 'http://localhost:3001';
  return { url: env.API_URL, key: env.SERVICE_ROLE_KEY, site };
}

const { url, key, site } = loadEnv();
if (!url || !key) throw new Error('URL Supabase ou clé service_role manquante.');
const db = createClient(url, key, { auth: { persistSession: false } });
const bucket = db.storage.from('photos');

async function download(id, width) {
  const res = await fetch(`https://images.unsplash.com/photo-${id}?w=${width}&q=${width > 1000 ? 80 : 70}&fm=jpg&fit=max`);
  if (!res.ok) throw new Error(`Unsplash ${id} : HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error(`Unsplash ${id} : ce n'est pas un JPEG`);
  return buf;
}

// 1. Compte technique propriétaire de la démo
let ownerId;
{
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const existing = data?.users.find((u) => u.email === OWNER_EMAIL);
  if (existing) ownerId = existing.id;
  else {
    const { data: created, error } = await db.auth.admin.createUser({ email: OWNER_EMAIL, email_confirm: true });
    if (error) throw error;
    ownerId = created.user.id;
  }
}

// 2. Événement (recréé à neuf si besoin)
let { data: event } = await db.from('events').select('id').eq('slug', DEMO_SLUG).maybeSingle();
if (event) {
  const { data: files } = await bucket.list(event.id, { limit: 1000 });
  if (files?.length) await bucket.remove(files.map((f) => `${event.id}/${f.name}`));
  await db.from('photos').delete().eq('event_id', event.id);
  await db.from('challenges').delete().eq('event_id', event.id);
} else {
  const { data: created, error } = await db.from('events').insert({
    slug: DEMO_SLUG, name: 'Camille & Julien', bride_name: 'Camille', groom_name: 'Julien',
    date: '2026-06-20', admin_id: ownerId, plan_type: 'premium', is_demo: true, terms_version: 'demo',
  }).select('id').single();
  if (error) throw error;
  event = created;
}
await db.from('events').update({ is_demo: true, plan_type: 'premium', moderation_enabled: false }).eq('id', event.id);

// 3. Photos (de la plus ancienne à la plus récente : la dernière apparaît en grand sur le Mur Live)
const start = Date.now() - PHOTOS.length * 7 * 60 * 1000;
for (const [index, [unsplashId, guestName, caption]] of PHOTOS.entries()) {
  const id = randomUUID();
  const storagePath = `${event.id}/${id}.jpg`;
  const thumbPath = `${event.id}/${id}.thumb.jpg`;
  const [full, thumb] = await Promise.all([download(unsplashId, 1600), download(unsplashId, 480)]);
  for (const [path, body] of [[storagePath, full], [thumbPath, thumb]]) {
    const { error } = await bucket.upload(path, body, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
  }
  const { error } = await db.from('photos').insert({
    id, event_id: event.id, storage_path: storagePath, thumb_path: thumbPath, status: 'approved',
    guest_name: guestName, caption, created_at: new Date(start + index * 7 * 60 * 1000).toISOString(),
  });
  if (error) throw error;
  process.stdout.write(`\r${index + 1}/${PHOTOS.length} photos`);
}

// 4. Défi en cours
await db.from('challenges').insert([
  { event_id: event.id, title: 'Un selfie avec les mariés', description: 'Le plus original gagne une danse avec Julien !', is_active: true },
  { event_id: event.id, title: 'Toute la table sur une photo', is_active: false },
]);

console.log(`\n\nDémo prête :
  Page invités : ${site}/event/${DEMO_SLUG}
  Galerie      : ${site}/event/${DEMO_SLUG}/gallery
  Mur Live     : ${site}/live/${DEMO_SLUG}`);
