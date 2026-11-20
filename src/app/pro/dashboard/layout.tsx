import { privatePage } from '@/lib/seo';

export const metadata = privatePage('Tableau de bord partenaire');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
