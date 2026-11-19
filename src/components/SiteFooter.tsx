import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { LEGAL_LINKS } from '@/lib/legal';

// Pied de page des pages publiques (pas sur le Live Wall ni le diaporama, affichés sur TV).
export default function SiteFooter({ dark = false }: { dark?: boolean }) {
    const color = dark ? 'rgba(255,255,255,0.6)' : '#888';
    return (
        <footer style={{ padding: '24px 16px', textAlign: 'center', fontSize: '0.85rem', color, borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}` }}>
            <nav aria-label="Informations légales" style={{ display: 'flex', gap: '8px 20px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                {LEGAL_LINKS.map(l => (
                    <Link key={l.href} href={l.href} style={{ color, textDecoration: 'underline' }}>{l.label}</Link>
                ))}
                <Link href="/pro" style={{ color, textDecoration: 'underline' }}>Partenaires</Link>
            </nav>
            <p style={{ margin: 0 }}>© {new Date().getFullYear()} {BRAND.name}</p>
        </footer>
    );
}
