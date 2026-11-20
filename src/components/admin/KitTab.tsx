'use client';

import { Copy, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { siteUrl } from '@/lib/brand';
import { useQrCode } from '@/hooks/useQrCode';
import type { Event } from '@/types';

// Chevalets à imprimer et lien à partager (QR code de la page invités).
export default function KitTab({ event }: { event: Pick<Event, 'slug' | 'name'> }) {
    const guestUrl = `${siteUrl()}/event/${event.slug}`;
    const qr = useQrCode(guestUrl);

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(guestUrl);
            toast.success('Lien copié');
        } catch {
            toast.error('Copie impossible : sélectionnez le lien à la main.');
        }
    }

    return (
        <div className="admin-narrow">
            <div className="admin-panel kit-panel">
                <div className="kit-preview">
                    <p className="kit-name">{event.name}</p>
                    <p className="kit-eyebrow">Scannez pour participer</p>
                    {qr ? <img src={qr} alt="QR code de votre événement" /> : <div className="kit-qr-placeholder" />}
                    <p className="kit-cta">Partagez vos photos en direct !</p>
                </div>

                <h3>Chevalets de table</h3>
                <p className="admin-hint">Une feuille A4 en paysage = 2 chevalets. Imprimez sur papier épais, coupez au milieu, pliez.</p>
                <a href={`/admin/${event.slug}/print`} target="_blank" rel="noopener noreferrer" className="btn-sage-primary sm">
                    <Printer size={18} style={{ marginRight: 8 }} /> Imprimer les chevalets
                </a>

                <div className="kit-link">
                    <p className="admin-hint">Ou envoyez directement le lien à vos invités (faire-part, WhatsApp…) :</p>
                    <div className="copy-row">
                        <input className="admin-input" readOnly value={guestUrl} onFocus={e => e.currentTarget.select()} />
                        <button type="button" className="btn-ghost" onClick={copyLink}><Copy size={16} /> Copier</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
