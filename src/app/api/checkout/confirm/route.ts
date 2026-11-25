import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase-server';
import { fulfillCheckout } from '@/lib/fulfillment';

export const runtime = 'nodejs';

// Retour du client après paiement : on vérifie la session directement auprès de Stripe et on
// applique le pack sans attendre le webhook (utile s'il est en retard, et en local où Stripe
// ne peut pas joindre le site). Le webhook reste la garantie si le client ferme la page.
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'checkout-confirm', 20);
  if (limited) return limited;

  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Vous devez être connecté.' }, { status: 401 });

    const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: unknown };
    if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }

    const session = await getStripe().checkout.sessions.retrieve(sessionId).catch(() => null);
    const eventId = session?.metadata?.event_id;
    if (!session || !eventId) return NextResponse.json({ error: 'Paiement introuvable.' }, { status: 404 });

    // Seul l'admin de l'événement peut confirmer son propre paiement.
    const { data: event } = await getSupabaseAdmin().from('events').select('admin_id').eq('id', eventId).maybeSingle();
    if (!event || event.admin_id !== user.id) {
      return NextResponse.json({ error: 'Paiement introuvable.' }, { status: 404 });
    }

    if (session.payment_status !== 'paid') {
      // Paiement différé (ex. virement SEPA) : le webhook l'appliquera à réception.
      return NextResponse.json({ status: 'pending' });
    }
    await fulfillCheckout(session);
    return NextResponse.json({ status: 'paid' });
  } catch (err) {
    console.error('Checkout confirm error:', err);
    return NextResponse.json({ error: 'Vérification du paiement impossible.' }, { status: 500 });
  }
}
