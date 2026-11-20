'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Image (data URL) du QR code pointant vers `url`. Chaîne vide tant qu'elle n'est pas prête.
export function useQrCode(url: string | null | undefined, width = 500): string {
  const [dataUrl, setDataUrl] = useState('');
  useEffect(() => {
    if (!url) return;
    let alive = true;
    QRCode.toDataURL(url, { width, margin: 2 })
      .then((value) => { if (alive) setDataUrl(value); })
      .catch((err) => console.error('QR code error:', err));
    return () => { alive = false; };
  }, [url, width]);
  return dataUrl;
}
