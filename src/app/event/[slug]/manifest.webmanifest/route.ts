import { fetchPublicEvent } from '@/lib/events';
import { BRAND } from '@/lib/brand';

type Params = Promise<{ slug: string }>;

// Manifeste propre à chaque événement : l'icône « Ajouter à l'écran d'accueil » d'un invité
// ouvre directement la page du mariage, et non l'accueil du site.
export async function GET(_req: Request, { params }: { params: Params }) {
  const { slug } = await params;
  const event = await fetchPublicEvent(slug).catch(() => null);
  const name = event
    ? event.bride_name && event.groom_name ? `${event.bride_name} & ${event.groom_name}` : event.name
    : BRAND.name;
  const manifest = {
    name,
    short_name: name.length > 12 ? BRAND.name : name,
    start_url: `/event/${slug}`,
    scope: `/event/${slug}`,
    display: 'standalone',
    background_color: '#111111',
    theme_color: '#111111',
    lang: 'fr',
    icons: [
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  });
}
