import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { highestPlan } from '@/lib/plans';
import { fulfillCheckout } from '@/lib/fulfillment';
import type { PlanType } from '@/types';

export const runtime = 'nodejs';

// Webhook Stripe : applique les packs payés (avec /api/checkout/confirm au retour du client)
// et gère les remboursements.
// Événements à activer dans Stripe : checkout.session.completed,
// checkout.session.async_payment_succeeded, charge.refunded.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature');
  if (!secret || !signature) {
    return NextResponse.json({ error: 'Webhook non configuré.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch (err) {
    console.error('Stripe webhook signature error:', err);
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        // Paiements différés (ex: SEPA) : on attend async_payment_succeeded.
        if (session.payment_status === 'paid') await fulfillCheckout(session);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        if (charge.refunded) await handleFullRefund(charge);
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    // 500 => Stripe renverra l'événement plus tard.
    console.error(`Stripe webhook handling error (${event.type}):`, err);
    return NextResponse.json({ error: 'Erreur de traitement.' }, { status: 500 });
  }
}

async function handleFullRefund(charge: Stripe.Charge) {
  const db = getSupabaseAdmin();
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return;

  const { data: order, error } = await db
    .from('orders')
    .update({ status: 'refunded' })
    .eq('stripe_payment_intent', paymentIntent)
    .select('event_id')
    .maybeSingle();
  if (error) throw error;
  if (!order?.event_id) return;

  // Le pack redevient le plus élevé parmi les commandes encore payées.
  const { data: paidOrders, error: listErr } = await db
    .from('orders')
    .select('plan_type')
    .eq('event_id', order.event_id)
    .eq('status', 'paid');
  if (listErr) throw listErr;

  const plan = highestPlan((paidOrders ?? []).map((o) => o.plan_type as PlanType));
  const { error: upErr } = await db.from('events').update({ plan_type: plan }).eq('id', order.event_id);
  if (upErr) throw upErr;
}
