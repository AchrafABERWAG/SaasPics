import 'server-only';
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

// La version d'API est celle fixée par le SDK installé (pas de valeur en dur à maintenir).
export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY manquant.');
  stripeClient = new Stripe(key);
  return stripeClient;
}
