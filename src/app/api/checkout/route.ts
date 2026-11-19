import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase-server';
import { PLANS, canUpgrade, isPaidPlan, upgradePriceCents } from '@/lib/plans';
import { BRAND, siteUrl } from '@/lib/brand';
import type { Event } from '@/types';

export const runtime = 'nodejs';

// Crée une session de paiement Stripe pour passer un événement à un pack supérieur.
// Le pack n'est appliqué qu'à la réception du webhook (voir /api/stripe/webhook).
export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Vous devez être connecté.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { eventId, planType, immediateExecution } = body as { eventId?: string; planType?: string; immediateExecution?: boolean };
    if (typeof eventId !== 'string' || !isPaidPlan(planType)) {
      return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
    }
    // Droit de rétractation : le client doit demander expressément l'exécution immédiate (voir CGV).
    if (immediateExecution !== true) {
      return NextResponse.json({ error: "Veuillez accepter l'exécution immédiate du service." }, { status: 400 });
    }

    const { data: event } = await getSupabaseAdmin()
      .from('events')
      .select('id, slug, name, plan_type, admin_id, purged_at')
      .eq('id', eventId)
      .maybeSingle<Pick<Event, 'id' | 'slug' | 'name' | 'plan_type' | 'admin_id' | 'purged_at'>>();

    if (!event || event.admin_id !== user.id) {
      return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
    }
    if (event.purged_at) {
      return NextResponse.json({ error: 'Les photos de cet événement ont été supprimées après la fermeture de la galerie.' }, { status: 410 });
    }
    if (!canUpgrade(event.plan_type, planType)) {
      return NextResponse.json({ error: 'Cet événement dispose déjà de ce pack.' }, { status: 409 });
    }

    const amount = upgradePriceCents(event.plan_type, planType);
    const isUpgrade = event.plan_type !== 'discovery';
    const adminUrl = `${siteUrl()}/admin/${event.slug}`;

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: amount,
            product_data: {
              name: `${BRAND.name} — Pack ${PLANS[planType].label}${isUpgrade ? ` (passage depuis ${PLANS[event.plan_type].label})` : ''}`,
              description: event.name,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: user.email,
      client_reference_id: event.id,
      metadata: {
        event_id: event.id,
        user_id: user.id,
        plan_type: planType,
        from_plan: event.plan_type,
        immediate_execution: 'true',
      },
      invoice_creation: { enabled: true },
      custom_text: {
        submit: { message: "Vous avez demandé l'exécution immédiate du service : remboursement intégral possible jusqu'à la date de votre événement (voir nos CGV)." },
      },
      ...(process.env.STRIPE_AUTOMATIC_TAX === 'true' ? { automatic_tax: { enabled: true } } : {}),
      success_url: `${adminUrl}?payment=success`,
      cancel_url: `${adminUrl}?payment=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: 'Impossible de créer le paiement.' }, { status: 500 });
  }
}
