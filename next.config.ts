/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;
