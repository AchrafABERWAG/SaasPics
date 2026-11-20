import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/brand';

// Icône de l'application (onglet, écran d'accueil du téléphone) : initiale de la marque, or sur noir.
export function brandIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#111', color: '#D4AF37', fontSize: size * 0.62, fontWeight: 600,
          borderRadius: size > 64 ? 0 : size * 0.2,
        }}
      >
        {BRAND.name.charAt(0).toUpperCase()}
      </div>
    ),
    { width: size, height: size }
  );
}
