import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase-server';
import { sendEventEmailOnce } from '@/lib/notifications';
import { welcomeEmail } from '@/lib/email-templates';
import type { PlanType } from '@/types';

export const runtime = 'nodejs';

// Email de bienvenue après la création d'un événement.
// Sécurité : destinataire = l'utilisateur connecté uniquement, pour un événement qui lui appartient,
// une seule fois par événement. Aucun contenu n'est fourni par le navigateur.
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'welcome', 5);
  if (limited) return limited;

  const user = await getUserFromRequest(req);
  if (!user?.email) {
    return NextResponse.json({ error: 'Vous devez être connecté.' }, { status: 401 });
  }

  const { eventId } = (await req.json().catch(() => ({}))) as { eventId?: string };
  if (typeof eventId !== 'string') {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const { data: event } = await getSupabaseAdmin()
    .from('events')
    .select('id, slug, name, plan_type, admin_id')
    .eq('id', eventId)
    .maybeSingle();
  if (!event || event.admin_id !== user.id) {
    return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
  }

  try {
    const result = await sendEventEmailOnce({
      eventId: event.id,
      kind: 'welcome',
      to: user.email,
      template: welcomeEmail({ eventName: event.name, slug: event.slug, plan: event.plan_type as PlanType }),
    });
    return NextResponse.json({ status: result });
  } catch (err) {
    console.error('Welcome email error:', err);
    return NextResponse.json({ error: "L'email n'a pas pu être envoyé." }, { status: 502 });
  }
}
