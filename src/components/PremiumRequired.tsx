import Link from 'next/link';
import { Crown } from 'lucide-react';
import { PLANS, formatPrice } from '@/lib/plans';

// Écran plein (fond sombre, pensé pour une TV) affiché à la place d'une fonctionnalité Premium.
export default function PremiumRequired({ feature, slug }: { feature: string; slug: string }) {
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '16px', padding: '24px', textAlign: 'center', background: '#111', color: 'white',
        }}>
            <Crown size={48} color="#D4AF37" />
            <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2.2rem', margin: 0 }}>
                {feature} est inclus dans le pack Premium
            </h1>
            <p style={{ color: '#bbb', maxWidth: 480, margin: 0 }}>
                Diffusez les photos de vos invités en direct sur grand écran, pour {formatPrice(PLANS.premium.priceCents)}.
            </p>
            <Link
                href={`/admin/${slug}`}
                className="btn-gold"
                style={{ padding: '14px 28px', borderRadius: '50px', textDecoration: 'none', marginTop: '8px' }}
            >
                Organisateur ? Activer le Premium
            </Link>
        </div>
    );
}
