import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WINDOW_MS = 10 * 60 * 1000; // garder en phase avec OWN_DELETE_WINDOW_MS (src/lib/upload.ts)

// Un invité (sans compte) supprime une photo qu'il vient d'envoyer, grâce au jeton gardé sur
// son téléphone. Possible pendant 10 minutes ; ensuite, seuls les mariés peuvent la retirer.
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'delete-own', 20);
  if (limited) return limited;

  const { photoId, token } = (await req.json().catch(() => ({}))) as { photoId?: string; token?: string };
  if (typeof photoId !== 'string' || !UUID_RE.test(photoId) || typeof token !== 'string' || token.length < 32 || token.length > 128) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: photo } = await db
    .from('photos')
    .select('id, storage_path, thumb_path, delete_token_hash, created_at')
    .eq('id', photoId)
    .maybeSingle();

  const expected = photo?.delete_token_hash ? Buffer.from(photo.delete_token_hash, 'hex') : null;
  const given = createHash('sha256').update(token).digest();
  if (!photo || !expected || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return NextResponse.json({ error: 'Photo introuvable.' }, { status: 404 });
  }
  if (Date.now() - new Date(photo.created_at).getTime() > WINDOW_MS) {
    return NextResponse.json({ error: 'Le délai de 10 minutes est dépassé : demandez aux mariés de retirer la photo.' }, { status: 403 });
  }

  const files = [photo.storage_path, photo.thumb_path].filter((p): p is string => !!p);
  const { error: rmErr } = await db.storage.from('photos').remove(files);
  if (rmErr) {
    console.error('delete-own storage error:', rmErr);
    return NextResponse.json({ error: 'Erreur de suppression.' }, { status: 500 });
  }
  const { error } = await db.from('photos').delete().eq('id', photo.id);
  if (error) {
    console.error('delete-own row error:', error);
    return NextResponse.json({ error: 'Erreur de suppression.' }, { status: 500 });
  }
  return NextResponse.json({ status: 'deleted' });
}
