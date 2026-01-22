'use client';

import Link from 'next/link';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ConfirmationContent() {
    const searchParams = useSearchParams();
    const pack = searchParams.get('pack');

    let packName = 'Pack Inconnu';
    if (pack === 'discovery') packName = 'Pack DÉCOUVERTE';
    if (pack === 'essential') packName = 'Pack ESSENTIEL';
    if (pack === 'premium') packName = 'Pack PREMIUM';

    return (
        <div className="confirmation-content">
            <div className="success-icon">
                <CheckCircle size={80} color="var(--gold-primary)" />
            </div>

            <h1 className="confirmation-title">Merci pour votre confiance !</h1>
            <p className="confirmation-subtitle">
                Votre commande pour le <strong>{packName}</strong> a bien été validée.
            </p>

            <div className="next-steps">
                <h3>Prochaines étapes :</h3>
                <ul>
                    <li>1. Vous allez recevoir un email de confirmation.</li>
                    <li>2. Votre espace événement est en cours de création.</li>
                    <li>3. Vous pourrez configurer votre événement dans quelques instants.</li>
                </ul>
            </div>

            <Link href="/event/demo-mariage/admin" className="btn-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginTop: '30px' }}>
                Accéder à mon Espace <ArrowRight size={18} />
            </Link>
        </div>
    );
}

export default function ConfirmationPage() {
    return (
        <main className="confirmation-container">
            <div className="pricing-bg">
                <img
                    src="https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop"
                    alt="Wedding Background"
                />
                <div className="pricing-overlay" />
            </div>

            <Suspense fallback={<div style={{ color: 'white', textAlign: 'center', marginTop: '100px' }}>Chargement...</div>}>
                <ConfirmationContent />
            </Suspense>
        </main>
    );
}
