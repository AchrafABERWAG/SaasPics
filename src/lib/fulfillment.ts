import 'server-only';
import type Stripe from 'stripe';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { highestPlan, isPaidPlan } from '@/lib/plans';
import { getUserEmail, sendEventEmailOnce } from '@/lib/notifications';
import { partnerSaleEmail, paymentConfirmedEmail } from '@/lib/email-templates';
import type { PlanType } from '@/types';

// Applique un paiement Stripe réussi : commande, pack, commission, emails.
// Idempotent (une commande par session Stripe) : appelé par le webhook ET au retour du client
// sur le site (/api/checkout/confirm), le premier arrivé l'applique, le second ne fait rien.
export async function fulfillCheckout(session: Stripe.Checkout.Session) {
  const db = getSupabaseAdmin();
  const eventId = session.metadata?.event_id;
  const planType = session.metadata?.plan_type;
  if (!eventId || !isPaidPlan(planType)) {
    console.warn('Checkout session without expected metadata:', session.id);
    return;
  }

  const { data: ev, error: evErr } = await db
    .from('events')
    .select('id, slug, name, plan_type, admin_id, referred_by')
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
      immediate_execution_requested: session.metadata?.immediate_execution === 'true',
    },
    { onConflict: 'stripe_session_id', ignoreDuplicates: true }
  );
  if (orderErr) throw orderErr;

  const newPlan = highestPlan([ev.plan_type as PlanType, planType]);
  if (newPlan !== ev.plan_type) {
    const { error: upErr } = await db.from('events').update({ plan_type: newPlan }).eq('id', ev.id);
    if (upErr) throw upErr;
  }

  // Emails : un échec d'envoi ne doit jamais bloquer l'activation du pack.
  await notifyCheckout({
    eventId: ev.id, slug: ev.slug, eventName: ev.name, adminId: ev.admin_id, plan: newPlan,
    sessionId: session.id, customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
    amountPaidCents: session.amount_total ?? amountCents,
    partnerId: commissionCents > 0 ? ev.referred_by : null, commissionCents, purchasedPlan: planType,
  }).catch((err) => console.error('Checkout notification error:', err));
}

async function notifyCheckout(p: {
  eventId: string; slug: string; eventName: string; adminId: string; plan: PlanType;
  sessionId: string; customerEmail: string | null; amountPaidCents: number;
  partnerId: string | null; commissionCents: number; purchasedPlan: PlanType;
}) {
  const to = (await getUserEmail(p.adminId)) ?? p.customerEmail;
  if (to) {
    await sendEventEmailOnce({
      eventId: p.eventId, kind: 'payment_confirmed', ref: p.sessionId, to,
      template: paymentConfirmedEmail({ eventName: p.eventName, slug: p.slug, plan: p.plan, amountCents: p.amountPaidCents }),
    });
  }

  if (p.partnerId) {
    const { data: partner } = await getSupabaseAdmin().from('partners').select('user_id').eq('id', p.partnerId).maybeSingle();
    const partnerEmail = partner ? await getUserEmail(partner.user_id) : null;
    if (partnerEmail) {
      await sendEventEmailOnce({
        eventId: p.eventId, kind: 'partner_sale', ref: p.sessionId, to: partnerEmail,
        template: partnerSaleEmail({ eventName: p.eventName, plan: p.purchasedPlan, commissionCents: p.commissionCents }),
      });
    }
  }
}
