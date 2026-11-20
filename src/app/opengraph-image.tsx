import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/brand';

export const alt = BRAND.tagline;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #FDFBF7 0%, #F3E9DC 100%)', color: '#2D3748',
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 600, letterSpacing: 4, color: '#B8962E' }}>{BRAND.name}</div>
        <div style={{ fontSize: 48, marginTop: 24 }}>{BRAND.tagline}</div>
        <div style={{ fontSize: 30, marginTop: 40, color: '#718096' }}>
          Un QR code sur les tables · les photos de vos invités en direct
        </div>
      </div>
    ),
    size
  );
}
