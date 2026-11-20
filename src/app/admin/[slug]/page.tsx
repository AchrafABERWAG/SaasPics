'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Image as ImageIcon, LogOut, Play, Printer, Settings, Shield, Tv, X, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BRAND } from '@/lib/brand';
import { signOut } from '@/hooks/useSession';
import { fetchPublicEvent } from '@/lib/events';
import { PLANS } from '@/lib/plans';
import type { Event } from '@/types';
import LoginAdmin from '@/components/auth/LoginAdmin';
import PhotosTab from '@/components/admin/PhotosTab';
import ModerationTab from '@/components/admin/ModerationTab';
import ChallengesTab from '@/components/admin/ChallengesTab';
import SettingsTab from '@/components/admin/SettingsTab';
import KitTab from '@/components/admin/KitTab';

type Params = Promise<{ slug: string }>;
type Tab = 'photos' | 'moderation' | 'challenges' | 'settings' | 'kit';
type PaymentNotice = 'pending' | 'success' | 'canceled' | 'delayed' | null;

const PAYMENT_POLL_MS = 2000;
const PAYMENT_POLL_MAX = 20;

const SUBTITLES: Record<Tab, string> = {
    photos: 'Toutes les photos de vos invités',
    moderation: 'Les photos en attente de validation',
    challenges: 'Animez votre événement',
    settings: 'Configurez votre événement',
    kit: 'Invitez vos invités à participer',
};

export default function AdminPage({ params }: { params: Params }) {
    const { slug } = use(params);
    const [event, setEvent] = useState<Event | null>(null);
    const [eventExists, setEventExists] = useState(true);
    const [photoCount, setPhotoCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('photos');
    const [paymentNotice, setPaymentNotice] = useState<PaymentNotice>(null);

    const fetchEvent = useCallback(async () => {
        // La ligne complète n'est lisible que par l'admin de l'événement (RLS).
        const { data } = await supabase.from('events').select('*').eq('slug', slug).maybeSingle();
        setEvent((data as Event | null) ?? null);
    }, [slug]);

    const refreshCount = useCallback(
        () => fetchPublicEvent(slug).then(e => setPhotoCount(e?.photo_count ?? 0)).catch(() => {}),
        [slug]
    );

    const checkAuthAndFetch = useCallback(async () => {
        const publicEvent = await fetchPublicEvent(slug).catch(() => null);
        setEventExists(!!publicEvent);
        setPhotoCount(publicEvent?.photo_count ?? 0);
        if (publicEvent) await fetchEvent();
        setLoading(false);
    }, [slug, fetchEvent]);

    useEffect(() => {
        // checkAuthAndFetch() ne met l'état à jour qu'après ses requêtes (asynchrone).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        checkAuthAndFetch();
    }, [checkAuthAndFetch]);

    // Retour de Stripe (?payment=success|canceled) : le pack est appliqué par le webhook,
    // on attend donc que la commande apparaisse avant d'annoncer le succès.
    useEffect(() => {
        const payment = new URLSearchParams(window.location.search).get('payment');
        if (payment !== 'success' && payment !== 'canceled') return;
        window.history.replaceState(null, '', window.location.pathname);
        // L'URL n'est lisible qu'après le montage (pas côté serveur) : lecture unique, voulue.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPaymentNotice(payment === 'success' ? 'pending' : 'canceled');
        if (payment === 'success') setActiveTab('settings');
    }, []);

    useEffect(() => {
        if (paymentNotice !== 'pending' || !event?.id) return;
        let attempts = 0;
        const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const timer = setInterval(async () => {
            attempts++;
            const { data } = await supabase.from('orders').select('id').eq('event_id', event.id)
                .eq('status', 'paid').gte('created_at', since).limit(1);
            if (data && data.length > 0) {
                clearInterval(timer);
                await fetchEvent();
                setPaymentNotice('success');
            } else if (attempts >= PAYMENT_POLL_MAX) {
                clearInterval(timer);
                setPaymentNotice('delayed');
            }
        }, PAYMENT_POLL_MS);
        return () => clearInterval(timer);
    }, [paymentNotice, event?.id, fetchEvent]);

    if (loading) return <div className="page-status">Chargement…</div>;
    if (!eventExists) return <div className="page-status">Événement introuvable</div>;
    // L'événement existe mais n'est pas lisible : pas connecté, ou connecté avec un autre compte.
    if (!event) return <LoginAdmin onLoginSuccess={checkAuthAndFetch} />;

    const plan = PLANS[event.plan_type];
    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'photos', label: 'Photos', icon: <ImageIcon size={16} /> },
        ...(plan.moderation ? [{ id: 'moderation' as Tab, label: 'Modération', icon: <Shield size={16} /> }] : []),
        ...(plan.challenges ? [{ id: 'challenges' as Tab, label: 'Défis', icon: <Zap size={16} /> }] : []),
        { id: 'kit', label: 'QR code', icon: <Printer size={16} /> },
        { id: 'settings', label: 'Configuration', icon: <Settings size={16} /> },
    ];

    return (
        <div className="romance-wrapper admin-page">
            <nav className="admin-nav">
                <div className="admin-nav-top">
                    <div className="admin-nav-brand">
                        <span className="logo-text">{BRAND.name}</span>
                        <Link href="/dashboard">&larr; Mes événements</Link>
                    </div>
                    <div className="admin-nav-links">
                        {plan.liveWall ? (
                            <>
                                <a href={`/live/${slug}`} target="_blank" rel="noopener noreferrer"><Tv size={15} /> Mur Live</a>
                                <a href={`/event/${slug}/slideshow`} target="_blank" rel="noopener noreferrer"><Play size={15} /> Diaporama</a>
                            </>
                        ) : (
                            <button type="button" className="link-button" onClick={() => setActiveTab('settings')}>
                                <Tv size={15} /> Mur Live (Premium)
                            </button>
                        )}
                        <button type="button" className="link-button muted" onClick={signOut}><LogOut size={15} /> Déconnexion</button>
                    </div>
                </div>
                <div className="admin-tabs" role="tablist">
                    {tabs.map(t => (
                        <button key={t.id} type="button" role="tab" aria-selected={activeTab === t.id}
                            className={`admin-tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>
            </nav>

            <main className="admin-main">
                {paymentNotice && (
                    <div role="status" className={`notice notice-${paymentNotice}`}>
                        <span>
                            {paymentNotice === 'pending' && 'Paiement reçu, activation de votre pack en cours…'}
                            {paymentNotice === 'success' && `Merci ! Votre pack ${plan.label} est activé.`}
                            {paymentNotice === 'canceled' && 'Paiement annulé. Aucun montant n’a été débité.'}
                            {paymentNotice === 'delayed' && 'Votre paiement est en cours de confirmation. Votre pack sera activé dans quelques minutes (rafraîchissez la page).'}
                        </span>
                        {paymentNotice !== 'pending' && (
                            <button type="button" className="icon-button" onClick={() => setPaymentNotice(null)} aria-label="Fermer"><X size={16} /></button>
                        )}
                    </div>
                )}

                {event.plan_type === 'discovery' && activeTab !== 'settings' && (
                    <p className="discovery-banner">
                        Pack Découverte : <strong>{photoCount} / {PLANS.discovery.maxPhotos} photos</strong>, galerie {PLANS.discovery.galleryDuration} après le jour J.{' '}
                        <button type="button" className="link-button" onClick={() => setActiveTab('settings')}>Passer à un pack supérieur</button>
                    </p>
                )}

                <header className="admin-header">
                    <h1>{event.name}</h1>
                    <p>{SUBTITLES[activeTab]}</p>
                </header>

                {activeTab === 'photos' && <PhotosTab event={event} onChanged={refreshCount} />}
                {activeTab === 'moderation' && <ModerationTab event={event} onOpenSettings={() => setActiveTab('settings')} />}
                {activeTab === 'challenges' && <ChallengesTab eventId={event.id} />}
                {activeTab === 'kit' && <KitTab event={event} />}
                {activeTab === 'settings' && (
                    <SettingsTab
                        key={`${event.plan_type}-${event.moderation_enabled}-${event.bride_name}-${event.groom_name}`}
                        event={event}
                        paymentInProgress={paymentNotice === 'pending' || paymentNotice === 'delayed'}
                        onSaved={fetchEvent}
                    />
                )}
            </main>
        </div>
    );
}
