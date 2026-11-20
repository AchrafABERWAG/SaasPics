import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: { absolute: `${BRAND.proName} — Photographes et wedding planners` },
  description: `Proposez ${BRAND.name} à vos clients et touchez 20 % de commission sur chaque événement vendu.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
