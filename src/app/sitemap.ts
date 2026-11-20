import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/brand';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`, changeFrequency: 'monthly', priority,
  });
  return [
    page('', 1),
    page('/pricing', 0.9),
    page('/create', 0.8),
    page('/pro', 0.7),
    page('/cgv', 0.2),
    page('/mentions-legales', 0.2),
    page('/confidentialite', 0.2),
  ];
}
