import type { NextConfig } from 'next';
import { PRIVATE_PATHS } from './src/lib/seo';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), payment=()' },
];

const nextConfig: NextConfig = {
  // Masque la pastille « N » de Next.js affichée en développement (jamais visible en ligne).
  devIndicators: false,
  // En développement, autorise l'accès depuis un téléphone du réseau local (npm run dev:local).
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(',').filter(Boolean) ?? [],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Galeries d'invités et espaces privés : jamais indexés, même si un lien circule.
      ...PRIVATE_PATHS.map((p) => ({
        source: `${p}/:path*`,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
    ];
  },
};

export default nextConfig;
