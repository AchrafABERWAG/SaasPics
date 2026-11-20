import type { Metadata } from 'next';
import { fetchPublicEvent } from '@/lib/events';
import { BRAND } from '@/lib/brand';
import { PRIVATE_PAGE } from '@/lib/seo';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const event = await fetchPublicEvent(slug).catch(() => null);
  const title = event
    ? event.bride_name && event.groom_name ? `${event.bride_name} & ${event.groom_name}` : event.name
    : 'Galerie photo';
  const description = `Partagez vos photos de l'événement en direct avec ${BRAND.name}.`;
  return {
    title, description, openGraph: { title, description }, ...PRIVATE_PAGE,
    manifest: `/event/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title, statusBarStyle: 'black-translucent' },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
