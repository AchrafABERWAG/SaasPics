import { NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase-server';
import { purgeEventPhotos } from '@/lib/purge';

export const runtime = 'nodejs';

// Suppression définitive d'un événement par son propriétaire : fichiers, photos, défis et
// signalements. Les commandes sont conservées (obligation comptable), sans lien vers l'événement.
export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Vous devez être connecté.' }, { status: 401 });

  const { eventId } = (await req.json().catch(() => ({}))) as { eventId?: string };
  if (typeof eventId !== 'string') return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });

  const db = getSupabaseAdmin();
  const { data: event } = await db.from('events').select('id, admin_id').eq('id', eventId).maybeSingle();
  if (!event || event.admin_id !== user.id) {
    return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
  }

  try {
    await purgeEventPhotos(event.id);
    const { error } = await db.from('events').delete().eq('id', event.id);
    if (error) throw error;
    return NextResponse.json({ status: 'deleted' });
  } catch (err) {
    console.error('Event deletion error:', err);
    return NextResponse.json({ error: 'La suppression a échoué.' }, { status: 500 });
  }
}
