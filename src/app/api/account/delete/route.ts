import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase-server';
import { purgeEventPhotos } from '@/lib/purge';

export const runtime = 'nodejs';

// Suppression du compte (droit à l'effacement) : photos de tous les événements, événements,
// fiche partenaire et compte. Les commandes sont conservées (obligation comptable, 10 ans),
// détachées du compte.
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'account-delete', 5);
  if (limited) return limited;

  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Vous devez être connecté.' }, { status: 401 });

  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (confirm !== 'SUPPRIMER') {
    return NextResponse.json({ error: 'Confirmation manquante.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  try {
    const { data: events, error } = await db.from('events').select('id').eq('admin_id', user.id);
    if (error) throw error;
    for (const ev of events ?? []) await purgeEventPhotos(ev.id);

    // Supprime aussi, en cascade, les événements et la fiche partenaire.
    const { error: delErr } = await db.auth.admin.deleteUser(user.id);
    if (delErr) throw delErr;
    return NextResponse.json({ status: 'deleted' });
  } catch (err) {
    console.error('Account deletion error:', err);
    return NextResponse.json({ error: 'La suppression a échoué.' }, { status: 500 });
  }
}
