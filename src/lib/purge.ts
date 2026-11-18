import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabase-server';

const PAGE = 100;
const MAX_PAGES = 1000; // garde-fou : 100 000 fichiers par événement

// Supprime définitivement les fichiers et les lignes photos d'un événement, puis marque
// l'événement comme purgé. L'événement, les commandes et le compte sont conservés.
// Renvoie le nombre de fichiers supprimés.
export async function purgeEventPhotos(eventId: string): Promise<number> {
  const db = getSupabaseAdmin();
  const bucket = db.storage.from('photos');
  let removed = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    // Toujours relister depuis le début : la page précédente vient d'être supprimée.
    const { data: files, error } = await bucket.list(eventId, { limit: PAGE });
    if (error) throw error;
    if (!files || files.length === 0) break;

    const { error: rmErr } = await bucket.remove(files.map((f) => `${eventId}/${f.name}`));
    if (rmErr) throw rmErr;
    removed += files.length;
  }

  const { error: delErr } = await db.from('photos').delete().eq('event_id', eventId);
  if (delErr) throw delErr;

  const { error: upErr } = await db.from('events').update({ purged_at: new Date().toISOString() }).eq('id', eventId);
  if (upErr) throw upErr;

  return removed;
}
