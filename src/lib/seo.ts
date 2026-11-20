import type { Metadata } from 'next';

// Pages privées (espaces admin, galeries d'invités...) : jamais indexées par les moteurs.
export const PRIVATE_PAGE: Metadata = { robots: { index: false, follow: false } };

export const privatePage = (title: string): Metadata => ({ title, ...PRIVATE_PAGE });

// Chemins à ne pas indexer (robots.txt + en-tête X-Robots-Tag, voir next.config.ts).
export const PRIVATE_PATHS = ['/admin', '/event', '/live', '/dashboard', '/api', '/pro/dashboard', '/pro/login', '/reset-password'];
