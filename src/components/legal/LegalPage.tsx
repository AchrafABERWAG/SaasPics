import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { LEGAL, isPlaceholder } from '@/lib/legal';
import SiteFooter from '@/components/SiteFooter';

export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="romance-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <main style={{ maxWidth: 820, width: '100%', margin: '0 auto', padding: '48px 20px', flex: 1, lineHeight: 1.7, color: '#2D3748' }}>
                <Link href="/" style={{ color: '#888', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', marginBottom: 24 }}>
                    <ArrowLeft size={16} /> Retour à l&apos;accueil
                </Link>
                <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2.6rem', margin: '0 0 6px 0' }}>{title}</h1>
                <p style={{ color: '#888', marginTop: 0 }}>Dernière mise à jour : {LEGAL.lastUpdated}</p>
                <div className="legal-content">{children}</div>
            </main>
            <SiteFooter />
        </div>
    );
}

// Valeur légale : affichée en rouge tant qu'elle n'est pas complétée dans src/lib/legal.ts.
export function F({ v }: { v: string }) {
    if (!isPlaceholder(v)) return <>{v}</>;
    return <mark style={{ background: '#FDECEC', color: '#B42318', padding: '0 4px', borderRadius: 4 }}>{v}</mark>;
}
