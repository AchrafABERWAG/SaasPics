import { supabase } from '@/lib/supabase';
import type { PaidPlan } from '@/lib/plans';

// Redirige vers la page de paiement Stripe pour passer `eventId` au pack `planType`.
// Lève une erreur (message lisible) si la session ne peut pas être créée.
export async function startCheckout(eventId: string, planType: PaidPlan): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Vous devez être connecté.');

  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ eventId, planType }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || 'Impossible de lancer le paiement.');

  window.location.href = data.url;
}
