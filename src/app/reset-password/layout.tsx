import { privatePage } from '@/lib/seo';

export const metadata = privatePage('Nouveau mot de passe');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
