'use client';

import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { saveReferralCode } from '@/lib/referral';

// Éléments globaux côté navigateur : notifications et capture du code partenaire (?ref=).
export default function AppProviders() {
  useEffect(() => {
    saveReferralCode(new URLSearchParams(window.location.search).get('ref'));
  }, []);

  return <Toaster position="top-center" toastOptions={{ duration: 4000 }} />;
}
