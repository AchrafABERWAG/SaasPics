import { privatePage } from '@/lib/seo';

export const metadata = privatePage('Espace organisateur');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
