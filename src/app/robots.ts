import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/brand';
import { PRIVATE_PATHS } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
