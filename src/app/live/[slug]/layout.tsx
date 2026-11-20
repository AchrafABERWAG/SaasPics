import { privatePage } from '@/lib/seo';

export const metadata = privatePage('Mur Live');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
