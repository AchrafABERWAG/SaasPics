import { privatePage } from '@/lib/seo';

export const metadata = privatePage('Mes événements');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
