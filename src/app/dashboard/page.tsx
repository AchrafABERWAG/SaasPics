'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, LogOut, Calendar, ExternalLink, Briefcase } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession, signOut } from '@/hooks/useSession';
import { PLANS } from '@/lib/plans';
import { BRAND } from '@/lib/brand';
import LoginAdmin from '@/components/auth/LoginAdmin';
import SiteFooter from '@/components/SiteFooter';
import { authedPost } from '@/lib/api';
import type { Event } from '@/types';
import toast from 'react-hot-toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

type EventSummary = Pick<Event, 'id' | 'slug' | 'name' | 'date' | 'plan_type' | 'expires_at' | 'purged_at'>;

export default function DashboardPage() {
    const { session, loading: sessionLoading } = useSession();
    const [events, setEvents] = useState<EventSummary[] | null>(null);
    const [isPartner, setIsPartner] = useState(false);
    const [now] = useState(() => Date.now());
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [confirm, dialog] = useConfirm();

    async function deleteAccount() {
        const ok = await confirm({
            title: 'Supprimer votre compte ?',
            message: 'Votre compte, vos événements et toutes leurs photos seront supprimés immédiatement et définitivement. Les factures sont conservées (obligation légale).',
            confirmLabel: 'Supprimer mon compte',
            danger: true,
            requireText: 'SUPPRIMER',
        });
        if (!ok) return;
        setDeletingAccount(true);
        try {
            await authedPost('/api/account/delete', { confirm: 'SUPPRIMER' });
            await supabase.auth.signOut();
            // Rechargement complet voulu : plus aucune donnée du compte supprimé en mémoire.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = '/';
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'La suppression a échoué.');
            setDeletingAccount(false);
        }
    }

    useEffect(() => {
        if (!session) return;
        // RLS : seuls les événements de l'utilisateur connecté sont renvoyés.
        supabase
            .from('events')
            .select('id, slug, name, date, plan_type, expires_at, purged_at')
            .order('date', { ascending: false })
            .then(({ data }) => setEvents((data as EventSummary[]) ?? []));
        supabase
            .from('partners')
            .select('id')
            .maybeSingle()
            .then(({ data }) => setIsPartner(!!data));
    }, [session]);

    if (sessionLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Chargement...</div>;
    if (!session) {
        return (
            <LoginAdmin
                title="Mes événements"
                subtitle="Connectez-vous à votre espace"
                onLoginSuccess={() => { /* useSession se met à jour tout seul */ }}
                footer={<>Pas encore d&apos;événement ? <Link href="/create" style={{ color: 'var(--gold-primary)' }}>Créer gratuitement</Link></>}
            />
        );
    }

    return (
        <div className="romance-wrapper" style={{ minHeight: "100vh" }}>
            {dialog}
            <nav className="romance-nav scrolled" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
                <div className="nav-container">
                    <Link href="/" className="nav-logo" style={{ textDecoration: 'none' }}>
                        <span className="logo-text">{BRAND.name}</span>
                    </Link>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {isPartner && (
                            <Link href="/pro/dashboard" className="btn-sage-outline sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Briefcase size={16} /> Espace Pro
                            </Link>
                        )}
                        <button onClick={signOut} className="btn-sage-outline sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <LogOut size={16} /> Déconnexion
                        </button>
                    </div>
                </div>
            </nav>

            <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '30px' }}>
                    <div>
                        <h1 className="hero-title" style={{ fontSize: '2.4rem', margin: 0 }}>Mes événements</h1>
                        <p style={{ color: '#888', marginTop: 6 }}>{session.user.email}</p>
                    </div>
                    <Link href="/create" className="btn-rose-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Plus size={18} /> Nouvel événement
                    </Link>
                </header>

                {events === null ? (
                    <p style={{ color: '#888' }}>Chargement...</p>
                ) : events.length === 0 ? (
                    <div className="price-card" style={{ padding: '40px', textAlign: 'center' }}>
                        <p style={{ color: '#666', marginBottom: '20px' }}>Vous n&apos;avez pas encore d&apos;événement.</p>
                        <Link href="/create" className="btn-sage-primary">Créer mon premier événement</Link>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {events.map(ev => <EventRow key={ev.id} event={ev} now={now} />)}
                    </div>
                )}

                <div style={{ marginTop: 48, textAlign: 'center' }}>
                    <button type="button" onClick={deleteAccount} disabled={deletingAccount}
                        style={{ background: 'none', border: 'none', color: '#B42318', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem' }}>
                        {deletingAccount ? 'Suppression du compte…' : 'Supprimer mon compte et toutes mes données'}
                    </button>
                </div>
            </div>
            <SiteFooter />
        </div>
    );
}

function EventRow({ event, now }: { event: EventSummary; now: number }) {
    const expired = event.expires_at ? new Date(event.expires_at).getTime() < now : false;
    const status = event.purged_at
        ? 'Photos supprimées'
        : expired
            ? 'Galerie fermée'
            : event.expires_at
                ? `Galerie jusqu'au ${new Date(event.expires_at).toLocaleDateString('fr-FR')}`
                : '';

    return (
        <div className="price-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', padding: '24px', textAlign: 'left', width: '100%', maxWidth: 'none' }}>
            <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: '1.2rem', margin: '0 0 6px 0', overflowWrap: 'anywhere' }}>{event.name}</h3>
                <p style={{ color: '#888', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: 0 }}>
                    <Calendar size={14} /> {new Date(event.date).toLocaleDateString('fr-FR')}
                    <span>· Pack {PLANS[event.plan_type].label}</span>
                    {status && <span>· {status}</span>}
                </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a href={`/event/${event.slug}`} target="_blank" rel="noopener noreferrer" className="btn-sage-outline sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ExternalLink size={14} /> Page invités
                </a>
                <Link href={`/admin/${event.slug}`} className="btn-sage-primary sm">Gérer</Link>
            </div>
        </div>
    );
}
