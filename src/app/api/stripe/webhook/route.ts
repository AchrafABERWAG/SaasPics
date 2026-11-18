import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { highestPlan, isPaidPlan } from '@/lib/plans';
import type { PlanType } from '@/types';

export const runtime = 'nodejs';

// Webhook Stripe : seule source de vérité pour appliquer un pack payant.
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

async function fulfillCheckout(session: Stripe.Checkout.Session) {
  const db = getSupabaseAdmin();
  const eventId = session.metadata?.event_id;
  const planType = session.metadata?.plan_type;
  if (!eventId || !isPaidPlan(planType)) {
    console.warn('Checkout session without expected metadata:', session.id);
    return;
  }

  const { data: ev, error: evErr } = await db
    .from('events')
    .select('id, name, plan_type, admin_id, referred_by')
    .eq('id', eventId)
    .maybeSingle();
  if (evErr) throw evErr;
  if (!ev) {
    console.warn('Checkout for unknown event:', eventId);
    return;
  }

  // Commission partenaire : calculée sur le montant hors taxes, si le partenaire est validé.
  const amountCents = session.amount_subtotal ?? session.amount_total ?? 0;
  let commissionCents = 0;
  if (ev.referred_by) {
    const { data: partner } = await db
      .from('partners')
      .select('status, commission_rate')
      .eq('id', ev.referred_by)
      .maybeSingle();
    if (partner?.status === 'approved') {
      commissionCents = Math.round(amountCents * Number(partner.commission_rate));
    }
  }

  // Idempotent : Stripe peut envoyer le même événement plusieurs fois.
  const { error: orderErr } = await db.from('orders').upsert(
    {
      event_id: ev.id,
      user_id: ev.admin_id,
      partner_id: commissionCents > 0 ? ev.referred_by : null,
      event_name: ev.name,
      plan_type: planType,
      amount_cents: amountCents,
      currency: session.currency ?? 'eur',
      status: 'paid',
      stripe_session_id: session.id,
      stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
      commission_cents: commissionCents,
    },
    { onConflict: 'stripe_session_id', ignoreDuplicates: true }
  );
  if (orderErr) throw orderErr;

  const newPlan = highestPlan([ev.plan_type as PlanType, planType]);
  if (newPlan !== ev.plan_type) {
    const { error: upErr } = await db.from('events').update({ plan_type: newPlan }).eq('id', ev.id);
    if (upErr) throw upErr;
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
