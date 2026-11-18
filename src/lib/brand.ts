// Nom de marque provisoire : le changer ici le change partout (interface, emails, chevalets).
export const BRAND = {
  name: 'Lumina',
  proName: 'Lumina Pro',
  tagline: 'Partagez vos photos en direct',
};

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

// Domaine affiché (ex: sur les chevalets), dérivé de NEXT_PUBLIC_SITE_URL.
export function siteHost(): string {
  return siteUrl().replace(/^https?:\/\//, '');
}
