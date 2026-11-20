'use client';

import { useEffect } from 'react';

// Empêche l'écran de se mettre en veille (Mur Live, diaporama sur un ordinateur ou une TV).
// Le verrou est relâché par le navigateur quand l'onglet est masqué : on le reprend au retour.
export function useWakeLock(active = true) {
    useEffect(() => {
        if (!active || !('wakeLock' in navigator)) return;
        let lock: WakeLockSentinel | null = null;
        let cancelled = false;

        const acquire = async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                const next = await navigator.wakeLock.request('screen');
                if (cancelled) next.release().catch(() => {});
                else lock = next;
            } catch {
                // Refusé (batterie faible, navigateur) : sans gravité.
            }
        };

        acquire();
        document.addEventListener('visibilitychange', acquire);
        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', acquire);
            lock?.release().catch(() => {});
        };
    }, [active]);
}
