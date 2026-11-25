import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase-server';
import { PLANS, canUpgrade, isPaidPlan, upgradePriceCents } from '@/lib/plans';
import { BRAND, siteUrl } from '@/lib/brand';
import { fulfillCheckout } from '@/lib/fulfillment';
import type { Event } from '@/types';

export const runtime = 'nodejs';

// Crée une session de paiement Stripe pour passer un événement à un pack supérieur.
// Le pack est appliqué au retour du client (/api/checkout/confirm) ou par le webhook Stripe.
export async function POST(req: Request) {
  const limited = await rateLimit(req, 'checkout', 20);
  if (limited) return limited;

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
    const db = getSupabaseAdmin();

    // Anti double paiement : sessions de ces dernières 24 h (durée de vie d'une session Stripe).
    const { data: recent } = await db
      .from('checkout_sessions')
      .select('stripe_session_id, plan_type')
      .eq('event_id', event.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5);
    for (const row of recent ?? []) {
      const existing = await getStripe().checkout.sessions.retrieve(row.stripe_session_id);
      if (existing.status === 'complete') {
        const { data: applied } = await db.from('orders').select('id').eq('stripe_session_id', existing.id).maybeSingle();
        if (applied) continue; // déjà appliqué : un passage au pack supérieur reste possible

        // Payé mais pas encore appliqué (webhook en retard) : on l'applique maintenant.
        if (existing.payment_status === 'paid') {
          await fulfillCheckout(existing);
          return NextResponse.json(
            { error: 'Votre paiement précédent vient d\'être appliqué : rechargez la page pour voir votre pack.' },
            { status: 409 }
          );
        }
        // Paiement différé en cours (ex. SEPA).
        return NextResponse.json(
          { error: "Un paiement pour cet événement vient d'être reçu : votre pack sera activé dans quelques instants." },
          { status: 409 }
        );
      }
      if (existing.status === 'open' && row.plan_type === planType && existing.amount_total === amount && existing.url) {
        return NextResponse.json({ url: existing.url });
      }
    }

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
      success_url: `${adminUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${adminUrl}?payment=canceled`,
    });

    const { error: logErr } = await db
      .from('checkout_sessions')
      .insert({ event_id: event.id, plan_type: planType, stripe_session_id: session.id });
    if (logErr) console.error('checkout_sessions insert error:', logErr);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: 'Impossible de créer le paiement.' }, { status: 500 });
  }
}
