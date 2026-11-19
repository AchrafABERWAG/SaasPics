'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, LogOut, Clock, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { useSession, signOut } from '@/hooks/useSession';
import { BRAND } from '@/lib/brand';
import { PLANS, formatPrice } from '@/lib/plans';
import { loadPartnerDraft, submitPartnerApplication } from '@/lib/partners';
import LoginAdmin from '@/components/auth/LoginAdmin';
import SiteFooter from '@/components/SiteFooter';
import type { Order, Partner } from '@/types';

export default function ProDashboardPage() {
    const { session, loading: sessionLoading } = useSession();
    const [partner, setPartner] = useState<Partner | null | undefined>(undefined);
    const [orders, setOrders] = useState<Order[]>([]);

    const load = useCallback(async () => {
        // RLS : le partenaire ne voit que sa fiche et les commandes qui lui sont rattachées.
        const { data } = await supabase.from('partners').select('*').maybeSingle();
        if (!data) {
            // Retour après confirmation de l'email : envoyer la candidature gardée en brouillon.
            const draft = loadPartnerDraft();
            if (draft) {
                try {
                    await submitPartnerApplication(draft);
                    const { data: created } = await supabase.from('partners').select('*').maybeSingle();
                    setPartner((created as Partner) ?? null);
                    return;
                } catch (err) {
                    console.error('Partner draft submission failed:', err);
                }
            }
            setPartner(null);
            return;
        }
        setPartner(data as Partner);
        if (data.status === 'approved') {
            const { data: rows } = await supabase.from('orders').select('*').eq('partner_id', data.id).order('created_at', { ascending: false });
            setOrders((rows as Order[]) ?? []);
        }
    }, []);

    useEffect(() => { if (session) load(); }, [session, load]);

    if (sessionLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Chargement...</div>;
    if (!session) {
        return (
            <LoginAdmin
                title={BRAND.proName}
                subtitle="Espace partenaires"
                onLoginSuccess={() => { /* useSession se met à jour tout seul */ }}
                footer={<>Pas encore partenaire ? <Link href="/pro/signup" style={{ color: 'var(--gold-primary)' }}>Envoyer une candidature</Link></>}
            />
        );
    }

    return (
        <div className="romance-wrapper" style={{ minHeight: '100vh' }}>
            <nav className="romance-nav scrolled" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
                <div className="nav-container">
                    <Link href="/pro" className="nav-logo" style={{ textDecoration: 'none' }}>
                        <span className="logo-text">{BRAND.proName}</span>
                    </Link>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <Link href="/dashboard" className="btn-sage-outline sm">Mes événements</Link>
                        <button onClick={signOut} className="btn-sage-outline sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <LogOut size={16} /> Déconnexion
                        </button>
                    </div>
                </div>
            </nav>

            <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
                {partner === undefined ? (
                    <p style={{ textAlign: 'center', color: '#888' }}><Loader2 className="animate-spin" /></p>
                ) : partner === null ? (
                    <StatusCard title="Aucune candidature" text="Vous n'avez pas encore envoyé de candidature partenaire.">
                        <Link href="/pro/signup" className="btn-sage-primary">Devenir partenaire</Link>
                    </StatusCard>
                ) : partner.status === 'pending' ? (
                    <StatusCard icon={<Clock size={40} color="#D4AF37" />} title="Candidature en cours d'examen"
                        text={`Merci ${partner.first_name} ! Nous étudions votre candidature et revenons vers vous sous 48 h par email.`} />
                ) : partner.status === 'rejected' ? (
                    <StatusCard icon={<XCircle size={40} color="#B42318" />} title="Candidature non retenue"
                        text="Votre candidature n'a pas été retenue pour le moment. N'hésitez pas à nous contacter pour en savoir plus." />
                ) : (
                    <ApprovedDashboard partner={partner} orders={orders} />
                )}
            </div>
            <SiteFooter />
        </div>
    );
}

function StatusCard({ icon, title, text, children }: { icon?: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
    return (
        <div className="price-card" style={{ padding: '48px 32px', textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
            {icon && <div style={{ marginBottom: 16 }}>{icon}</div>}
            <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2rem', marginBottom: 12 }}>{title}</h1>
            <p style={{ color: '#666', marginBottom: children ? 24 : 0 }}>{text}</p>
            {children}
        </div>
    );
}

function ApprovedDashboard({ partner, orders }: { partner: Partner; orders: Order[] }) {
    const link = typeof window !== 'undefined' ? `${window.location.origin}/?ref=${partner.referral_code}` : '';
    const paid = orders.filter(o => o.status === 'paid');
    const due = paid.filter(o => !o.commission_paid_at).reduce((sum, o) => sum + o.commission_cents, 0);
    const received = paid.filter(o => o.commission_paid_at).reduce((sum, o) => sum + o.commission_cents, 0);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            toast.success('Lien copié !');
        } catch {
            toast.error('Copie impossible : sélectionnez le lien manuellement.');
        }
    };

    return (
        <>
            <h1 className="hero-title" style={{ fontSize: '2.4rem', marginBottom: 24 }}>Bonjour {partner.first_name}</h1>

            <div className="price-card" style={{ padding: 28, textAlign: 'left', marginBottom: 24, width: '100%', maxWidth: 'none' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 8 }}>Votre lien partenaire</h3>
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: 14 }}>
                    Partagez-le avec vos clients : vous touchez {Math.round(Number(partner.commission_rate) * 100)} % sur chaque pack acheté
                    (le lien reste valable 30 jours sur leur appareil). Code : <strong>{partner.referral_code}</strong>
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input readOnly value={link} onFocus={e => e.currentTarget.select()} aria-label="Lien partenaire"
                        style={{ flex: '1 1 260px', padding: '12px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#FAFAFA', minWidth: 0 }} />
                    <button type="button" onClick={copy} className="btn-sage-primary sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Copy size={16} /> Copier
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                <Stat label="Ventes" value={String(paid.length)} />
                <Stat label="Commission à percevoir" value={formatPrice(due)} />
                <Stat label="Commission versée" value={formatPrice(received)} />
            </div>

            <div className="price-card" style={{ padding: 28, textAlign: 'left', width: '100%', maxWidth: 'none' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 16 }}>Vos ventes</h3>
                {orders.length === 0 ? (
                    <p style={{ color: '#888' }}>Aucune vente pour le moment. Partagez votre lien avec vos prochains mariés !</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', color: '#888' }}>
                                    <th style={cell}>Date</th><th style={cell}>Événement</th><th style={cell}>Pack</th>
                                    <th style={cell}>Montant</th><th style={cell}>Commission</th><th style={cell}>Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map(o => (
                                    <tr key={o.id} style={{ borderTop: '1px solid #eee' }}>
                                        <td style={cell}>{new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
                                        <td style={cell}>{o.event_name}</td>
                                        <td style={cell}>{PLANS[o.plan_type].label}</td>
                                        <td style={cell}>{formatPrice(o.amount_cents)}</td>
                                        <td style={cell}>{formatPrice(o.commission_cents)}</td>
                                        <td style={cell}>{o.status === 'refunded' ? 'Remboursée' : o.commission_paid_at ? 'Versée' : 'À percevoir'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}

const cell: React.CSSProperties = { padding: '10px 8px', whiteSpace: 'nowrap' };

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="price-card" style={{ padding: 20, textAlign: 'left', width: '100%', maxWidth: 'none' }}>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 6px 0' }}>{label}</p>
            <p style={{ fontSize: '1.6rem', margin: 0, color: '#222' }}>{value}</p>
        </div>
    );
}
