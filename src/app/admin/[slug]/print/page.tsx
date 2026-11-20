'use client';

import { use, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2 } from 'lucide-react';
import { PublicEvent } from '@/types';
import { fetchPublicEvent } from '@/lib/events';
import { siteHost, siteUrl } from '@/lib/brand';

type Params = Promise<{ slug: string }>;

export default function PrintPage({ params }: { params: Params }) {
    const { slug } = use(params);
    const [event, setEvent] = useState<PublicEvent | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPublicEvent(slug).catch(() => null).then((data) => {
            setEvent(data);
            setLoading(false);
        });
    }, [slug]);

    useEffect(() => {
        if (event?.slug) {
            const url = `${siteUrl()}/event/${event.slug}`;
            QRCode.toDataURL(url, { width: 500, margin: 2 })
                .then(url => setQrCodeUrl(url))
                .catch(err => console.error("QR Code error:", err));
        }
    }, [event]);

    // Auto-print when ready
    useEffect(() => {
        if (!loading && event && qrCodeUrl) {
            setTimeout(() => {
                window.print();
            }, 1000);
        }
    }, [loading, event, qrCodeUrl]);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'white', color: '#9ca3af' }}>
            <Loader2 style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }} /> Préparation de l'impression...
        </div>
    );

    if (!event) return <div>Événement introuvable</div>;

    return (
        <div className="print-body" style={{ backgroundColor: 'white', minHeight: '100vh' }}>
            <style jsx global>{`
                @page {
                    size: A4 landscape;
                    margin: 0;
                }
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .no-print {
                        display: none;
                    }
                }
                .print-page {
                    width: 297mm;
                    height: 210mm;
                    display: flex;
                    margin: 0 auto;
                    background: white;
                }
                .print-card {
                    width: 50%;
                    height: 100%;
                    border: 1px dashed #ddd; /* Cut line */
                    padding: 20mm;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
                .card-border {
                    width: 100%;
                    height: 100%;
                    border: 3px solid #D4AF37;
                    border-radius: 10mm;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: #F9F5F0;
                    box-sizing: border-box;
                    padding: 20px;
                }
            `}</style>

            <div className="print-page">
                {/* Card 1 */}
                <div className="print-card" style={{ borderRight: '1px dashed #ccc' }}>
                    <div className="card-border">
                        <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2.5rem', color: '#D4AF37', margin: '0 0 1rem 0', textAlign: 'center' }}>{event.name}</h1>
                        <p style={{ color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 2rem 0', fontSize: '0.875rem' }}>Scannez pour participer</p>

                        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', marginBottom: '1.5rem', width: '256px', height: '256px', boxSizing: 'border-box' }}>
                            {qrCodeUrl && <img src={qrCodeUrl} style={{ width: '100%', height: '100%', display: 'block' }} alt="QR Code" />}
                        </div>

                        <p style={{ fontSize: '1.25rem', textAlign: 'center', color: '#333', margin: '0 0 0.5rem 0', maxWidth: '80%' }}>
                            Partagez vos photos en direct sur le grand écran !
                        </p>
                        <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem' }}>
                            {siteHost()}/event/{slug}
                        </p>
                    </div>
                </div>

                {/* Card 2 */}
                <div className="print-card">
                    <div className="card-border">
                        <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2.5rem', color: '#D4AF37', margin: '0 0 1rem 0', textAlign: 'center' }}>{event.name}</h1>
                        <p style={{ color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 2rem 0', fontSize: '0.875rem' }}>Scannez pour participer</p>

                        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', marginBottom: '1.5rem', width: '256px', height: '256px', boxSizing: 'border-box' }}>
                            {qrCodeUrl && <img src={qrCodeUrl} style={{ width: '100%', height: '100%', display: 'block' }} alt="QR Code" />}
                        </div>

                        <p style={{ fontSize: '1.25rem', textAlign: 'center', color: '#333', margin: '0 0 0.5rem 0', maxWidth: '80%' }}>
                            Partagez vos photos en direct sur le grand écran !
                        </p>
                        <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem' }}>
                            {siteHost()}/event/{slug}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
