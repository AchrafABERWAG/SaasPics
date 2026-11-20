import type { Metadata } from 'next';
import { PLANS, formatPrice } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Tarifs',
  description: `Découverte gratuite, Essentiel à ${formatPrice(PLANS.essential.priceCents)}, Premium à ${formatPrice(PLANS.premium.priceCents)} : un paiement unique par événement, sans abonnement.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
