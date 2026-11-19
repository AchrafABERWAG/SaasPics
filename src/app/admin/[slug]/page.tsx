'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Check, X, Settings, Image as ImageIcon, Shield, Printer, Play, Zap, LogOut } from 'lucide-react';
import Link from 'next/link';
import { BRAND, siteUrl } from '@/lib/brand';
import { signOut } from '@/hooks/useSession';
import PhotosTab from '@/components/admin/PhotosTab';
import { Photo, Challenge, Event } from '@/types';
import { fetchPublicEvent, friendlyDbError, photoUrl } from '@/lib/events';
import { PLANS, canUpgrade, formatPrice, upgradePriceCents, type PaidPlan } from '@/lib/plans';
import { startCheckout } from '@/lib/checkout';
import { authedPost } from '@/lib/api';
import QRCode from 'qrcode';

import LoginAdmin from '@/components/auth/LoginAdmin';

type Params = Promise<{ slug: string }>;

const PAID_PLANS: PaidPlan[] = ['essential', 'premium'];
const PAYMENT_POLL_MS = 2000;
const PAYMENT_POLL_MAX = 20;

export default function AdminPage({ params }: { params: Params }) {
    const { slug } = use(params);
    const [event, setEvent] = useState<Event | null>(null);
    const [eventExists, setEventExists] = useState(true);
    const [photoCount, setPhotoCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'photos' | 'settings' | 'moderation' | 'kit' | 'challenges'>('photos');
    const [pendingPhotos, setPendingPhotos] = useState<Photo[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [newChallengeTitle, setNewChallengeTitle] = useState('');
    const [newChallengeDesc, setNewChallengeDesc] = useState('');
    const [upgradingTo, setUpgradingTo] = useState<PaidPlan | null>(null);
    const [immediateExecution, setImmediateExecution] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [paymentNotice, setPaymentNotice] = useState<'pending' | 'success' | 'canceled' | 'delayed' | null>(null);

    // Form Data (le pack n'est pas modifiable ici : il change uniquement après paiement)
    const [formData, setFormData] = useState({
        bride_name: '',
        groom_name: '',
        moderation_enabled: false
    });

    useEffect(() => {
        checkAuthAndFetch();
    }, [slug]);

    // Retour de Stripe (?payment=success|canceled) : le pack est appliqué par le webhook,
    // on attend donc que la commande apparaisse avant d'annoncer le succès.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const payment = params.get('payment');
        if (payment !== 'success' && payment !== 'canceled') return;
        window.history.replaceState(null, '', window.location.pathname);
        setPaymentNotice(payment === 'success' ? 'pending' : 'canceled');
    }, []);

    useEffect(() => {
        if (paymentNotice !== 'pending' || !event?.id) return;
        let attempts = 0;
        const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const timer = setInterval(async () => {
            attempts++;
            const { data } = await supabase
                .from('orders')
                .select('id')
                .eq('event_id', event.id)
                .eq('status', 'paid')
                .gte('created_at', since)
                .limit(1);
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
    }, [paymentNotice, event?.id]);

    async function deleteEvent() {
        if (!event) return;
        const typed = window.prompt(`Pour supprimer définitivement « ${event.name} » et toutes ses photos, tapez SUPPRIMER :`);
        if (typed !== 'SUPPRIMER') return;
        setDeleting(true);
        try {
            await authedPost('/api/events/delete', { eventId: event.id });
            window.location.href = '/dashboard';
        } catch (err) {
            alert(err instanceof Error ? err.message : 'La suppression a échoué.');
            setDeleting(false);
        }
    }

    async function handleUpgrade(planType: PaidPlan) {
        if (!event) return;
        setUpgradingTo(planType);
        try {
            await startCheckout(event.id, planType, immediateExecution);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Impossible de lancer le paiement.');
            setUpgradingTo(null);
        }
    }

    async function checkAuthAndFetch() {
        setLoading(true);
        const publicEvent = await fetchPublicEvent(slug).catch(() => null);
        setEventExists(!!publicEvent);
        setPhotoCount(publicEvent?.photo_count ?? 0);
        // La ligne complète n'est lisible que par l'admin de l'événement (RLS).
        if (publicEvent) await fetchEvent();
        setLoading(false);
    }

    useEffect(() => {
        if (event?.id) {
            if (activeTab === 'moderation') fetchPendingPhotos();
            if (activeTab === 'challenges') fetchChallenges();
        }
    }, [event, activeTab]);

    useEffect(() => {
        if (event?.id) {
            // Subscribe to new photos
            const channel = supabase
                .channel('admin-moderation')
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'photos', filter: `event_id=eq.${event.id}`
                }, () => {
                    if (activeTab === 'moderation') fetchPendingPhotos();
                })
                .subscribe();
            return () => { supabase.removeChannel(channel); };
        }
    }, [event, activeTab]);

    useEffect(() => {
        if (event?.slug) {
            const url = `${siteUrl()}/event/${event.slug}`;
            QRCode.toDataURL(url, { width: 500, margin: 2 })
                .then(url => setQrCodeUrl(url))
                .catch(err => console.error("QR Code error:", err));
        }
    }, [event]);

    async function fetchEvent() {
        const { data } = await supabase
            .from('events')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();

        setEvent((data as Event | null) ?? null);
        if (data) {
            setFormData({
                bride_name: data.bride_name || '',
                groom_name: data.groom_name || '',
                moderation_enabled: data.moderation_enabled || false
            });
        }
    }

    async function fetchPendingPhotos() {
        if (!event) return;
        const { data } = await supabase
            .from('photos')
            .select('*')
            .eq('event_id', event.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (data) setPendingPhotos(data as Photo[]);
    }

    async function fetchChallenges() {
        if (!event) return;
        const { data } = await supabase
            .from('challenges')
            .select('*')
            .eq('event_id', event.id)
            .order('created_at', { ascending: true });

        if (data) setChallenges(data as Challenge[]);
    }

    async function handleAddChallenge(e: React.FormEvent) {
        e.preventDefault();
        if (!newChallengeTitle.trim() || !event) return;

        const { error } = await supabase.from('challenges').insert({
            event_id: event.id,
            title: newChallengeTitle,
            description: newChallengeDesc,
            is_active: false
        });

        if (!error) {
            setNewChallengeTitle('');
            setNewChallengeDesc('');
            fetchChallenges();
        } else {
            alert('Erreur : ' + friendlyDbError(error.message));
        }
    }

    async function toggleChallenge(id: string, currentStatus: boolean) {
        if (!event) return;
        // Un seul défi actif à la fois (garanti aussi par un index unique en base).
        if (!currentStatus) {
            await supabase.from('challenges').update({ is_active: false }).eq('event_id', event.id).eq('is_active', true);
        }
        const { error } = await supabase.from('challenges').update({ is_active: !currentStatus }).eq('id', id);
        if (error) alert('Erreur : ' + friendlyDbError(error.message));
        fetchChallenges();
    }

    async function updateEvent(e: React.FormEvent) {
        e.preventDefault();
        if (!event) return;
        const { error } = await supabase
            .from('events')
            .update({
                bride_name: formData.bride_name,
                groom_name: formData.groom_name,
                moderation_enabled: formData.moderation_enabled
            })
            .eq('id', event.id);

        if (!error) {
            alert('Sauvegardé !');
            fetchEvent();
        } else {
            alert('Erreur : ' + friendlyDbError(error.message));
        }
    }

    async function moderatePhoto(photoId: string, status: 'approved' | 'rejected') {
        await supabase.from('photos').update({ status }).eq('id', photoId);
        // Optimistic UI update
        setPendingPhotos(prev => prev.filter(p => p.id !== photoId));
    }

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Chargement...</div>;
    if (!eventExists) return <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Événement introuvable</div>;

    // L'événement existe mais n'est pas lisible : pas connecté, ou connecté avec un autre compte.
    if (!event) {
        return <LoginAdmin onLoginSuccess={checkAuthAndFetch} />;
    }

    return (
        <div className="romance-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <nav className="romance-nav scrolled" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
                <div className="nav-container">
                    <div className="nav-logo" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                        <span className="logo-text">{BRAND.name} Admin</span>
                        <span style={{ display: 'flex', gap: 10, fontSize: '0.8rem' }}>
                            <Link href="/dashboard" style={{ color: '#888' }}>&larr; Mes événements</Link>
                            <button type="button" onClick={signOut} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <LogOut size={12} /> Déconnexion
                            </button>
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setActiveTab('photos')}
                            className="btn-sage-primary sm"
                            style={{ opacity: activeTab === 'photos' ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <ImageIcon size={16} /> Photos
                        </button>
                        <button
                            onClick={() => setActiveTab('moderation')}
                            className="btn-sage-primary sm"
                            style={{ opacity: activeTab === 'moderation' ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Shield size={16} /> Modération
                        </button>
                        {event.plan_type === 'premium' && (
                            <button
                                onClick={() => setActiveTab('challenges')}
                                className="btn-sage-primary sm"
                                style={{ opacity: activeTab === 'challenges' ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                                <Zap size={16} /> Défis
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('settings')}
                            className="btn-sage-primary sm"
                            style={{ opacity: activeTab === 'settings' ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Settings size={16} /> Configuration
                        </button>
                        <button
                            onClick={() => setActiveTab('kit')}
                            className="btn-sage-primary sm"
                            style={{ opacity: activeTab === 'kit' ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Printer size={16} /> Kit Média
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                        <a href={`/live/${slug}`} target="_blank" style={{ color: '#666', textDecoration: 'underline', fontSize: '0.9rem' }}>
                            Voir le Live{!PLANS[event.plan_type].liveWall && ' (Premium)'}
                        </a>
                        <a href={`/event/${slug}/slideshow`} target="_blank" style={{ color: '#D4AF37', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Play size={14} fill="#D4AF37" /> Diaporama{!PLANS[event.plan_type].liveWall && ' (Premium)'}
                        </a>
                    </div>
                </div>
            </nav>

            <div className="pricing-page-container" style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto', flex: 1, width: '100%' }}>
                {paymentNotice && (
                    <div
                        role="status"
                        style={{
                            maxWidth: 700, margin: '0 auto 30px auto', padding: '16px 20px', borderRadius: '12px', textAlign: 'center',
                            backgroundColor: paymentNotice === 'success' ? '#EEF3EC' : paymentNotice === 'canceled' ? '#F7F0EE' : '#FAF6EA',
                            border: '1px solid rgba(0,0,0,0.06)', color: '#333',
                        }}
                    >
                        {paymentNotice === 'pending' && 'Paiement reçu, activation de votre pack en cours…'}
                        {paymentNotice === 'success' && `Merci ! Votre pack ${PLANS[event.plan_type].label} est activé.`}
                        {paymentNotice === 'canceled' && 'Paiement annulé. Aucun montant n’a été débité.'}
                        {paymentNotice === 'delayed' && 'Votre paiement est en cours de confirmation. Votre pack sera activé dans quelques minutes (rafraîchissez la page).'}
                        {paymentNotice !== 'pending' && (
                            <button
                                type="button"
                                onClick={() => setPaymentNotice(null)}
                                aria-label="Fermer"
                                style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
                            >
                                <X size={16} style={{ verticalAlign: 'middle' }} />
                            </button>
                        )}
                    </div>
                )}

                {event.plan_type === 'discovery' && activeTab !== 'settings' && (
                    <div style={{ maxWidth: 700, margin: '0 auto 30px auto', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
                        Pack Découverte : <strong>{photoCount} / {PLANS.discovery.maxPhotos} photos</strong>, galerie {PLANS.discovery.galleryDuration} après le jour J.{' '}
                        <button
                            type="button"
                            onClick={() => setActiveTab('settings')}
                            style={{ background: 'none', border: 'none', color: '#A3B19C', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                            Passer à un pack supérieur
                        </button>
                    </div>
                )}

                <header style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 className="hero-title" style={{ fontSize: '3rem', marginBottom: '10px' }}>
                        <span className="serif-highlight">{event.name}</span>
                    </h1>
                    <p style={{ color: '#888', letterSpacing: 2, textTransform: 'uppercase', fontSize: '0.8rem' }}>
                        {{ photos: 'Toutes les photos de vos invités', moderation: 'Gérez les photos en attente', challenges: 'Animez votre événement', settings: 'Configurez votre événement', kit: 'Imprimez vos chevalets' }[activeTab]}
                    </p>
                </header>

                {activeTab === 'settings' && (
                    <form onSubmit={updateEvent} style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        {/* Toggle Moderation */}
                        <div className="price-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '30px', textAlign: 'left' }}>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '5px' }}>Mode Modération</h3>
                                <p style={{ color: '#666', fontSize: '0.9rem' }}>
                                    {PLANS[event.plan_type].moderation
                                        ? 'Si activé, les photos doivent être approuvées.'
                                        : 'Validez chaque photo avant qu’elle apparaisse : inclus dans le pack Premium.'}
                                </p>
                            </div>
                            {PLANS[event.plan_type].moderation && (
                            <label style={{ position: 'relative', display: 'inline-block', width: '60px', height: '34px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.moderation_enabled}
                                    onChange={e => setFormData({ ...formData, moderation_enabled: e.target.checked })}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: formData.moderation_enabled ? '#A3B19C' : '#ccc',
                                    transition: '.4s', borderRadius: '34px'
                                }}>
                                    <span style={{
                                        position: 'absolute', content: '""', height: '26px', width: '26px', left: '4px', bottom: '4px',
                                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%',
                                        transform: formData.moderation_enabled ? 'translateX(26px)' : 'translateX(0)'
                                    }}></span>
                                </span>
                            </label>
                            )}
                        </div>

                        {/* Couples Names */}
                        <div className="price-card" style={{ padding: '30px', textAlign: 'left' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Les Mariés</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <input
                                    type="text"
                                    placeholder="Prénom 1"
                                    style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#FAFAFA' }}
                                    value={formData.bride_name}
                                    onChange={e => setFormData({ ...formData, bride_name: e.target.value })}
                                />
                                <input
                                    type="text"
                                    placeholder="Prénom 2"
                                    style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#FAFAFA' }}
                                    value={formData.groom_name}
                                    onChange={e => setFormData({ ...formData, groom_name: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Plan */}
                        <div className="price-card" style={{ padding: '30px', textAlign: 'left' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Pack actif</h3>
                            <p style={{ fontSize: '1.1rem', color: '#222' }}>
                                {PLANS[event.plan_type].label}{event.plan_type === 'discovery' ? ' (gratuit)' : ''}
                            </p>
                            {event.expires_at && (
                                <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '5px' }}>
                                    Galerie disponible jusqu&apos;au {new Date(event.expires_at).toLocaleDateString('fr-FR')}
                                </p>
                            )}
                            {PAID_PLANS.some(p => canUpgrade(event.plan_type, p)) && (
                                <>
                                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.85rem', color: '#666', marginTop: '20px', cursor: 'pointer', lineHeight: 1.5 }}>
                                    <input type="checkbox" checked={immediateExecution} onChange={e => setImmediateExecution(e.target.checked)} style={{ marginTop: 3 }} />
                                    <span>
                                        Je demande l&apos;accès immédiat au service. Je pourrai me rétracter et être remboursé jusqu&apos;à la date de
                                        mon événement ; ensuite, je ne pourrai plus exercer mon droit de rétractation (<a href="/cgv" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>CGV</a>).
                                    </span>
                                </label>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
                                    {PAID_PLANS.filter(p => canUpgrade(event.plan_type, p)).map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => handleUpgrade(p)}
                                            disabled={upgradingTo !== null || !immediateExecution}
                                            className={p === 'premium' ? 'btn-sage-primary sm' : 'btn-rose-primary sm'}
                                            style={{ opacity: (upgradingTo && upgradingTo !== p) || !immediateExecution ? 0.5 : 1 }}
                                        >
                                            {upgradingTo === p
                                                ? 'Redirection…'
                                                : `Passer en ${PLANS[p].label} — ${formatPrice(upgradePriceCents(event.plan_type, p))}`}
                                        </button>
                                    ))}
                                </div>
                                </>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                            <button type="submit" className="btn-rose-primary" style={{ minWidth: 200 }}>Sauvegarder</button>
                        </div>

                        {/* Suppression définitive */}
                        <div className="price-card" style={{ padding: '30px', textAlign: 'left', border: '1px solid #F3C4C4', width: '100%', maxWidth: 'none' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: '#B42318' }}>Supprimer cet événement</h3>
                            <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '16px' }}>
                                Toutes les photos sont supprimées immédiatement et définitivement. Pensez à les télécharger avant.
                            </p>
                            <button type="button" onClick={deleteEvent} disabled={deleting}
                                style={{ background: 'none', border: '1px solid #B42318', color: '#B42318', padding: '10px 18px', borderRadius: 50, cursor: 'pointer' }}>
                                {deleting ? 'Suppression…' : 'Supprimer définitivement'}
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'moderation' && (
                    <div>
                        {!formData.moderation_enabled ? (
                            <div style={{ textAlign: 'center', padding: '80px 0' }}>
                                <Shield size={48} style={{ margin: '0 auto 20px auto', color: '#ccc' }} />
                                <h3 style={{ fontSize: '1.5rem', color: '#666', marginBottom: '10px' }}>La modération est désactivée</h3>
                                <p style={{ color: '#888' }}>Toutes les photos sont publiées automatiquement.</p>
                                <button
                                    onClick={() => {
                                        if (PLANS[event.plan_type].moderation) {
                                            setFormData({ ...formData, moderation_enabled: true });
                                        }
                                        setActiveTab('settings');
                                    }}
                                    style={{ marginTop: '20px', color: '#A3B19C', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                                >
                                    {PLANS[event.plan_type].moderation
                                        ? 'Activer la modération dans les réglages'
                                        : 'La modération est incluse dans le pack Premium'}
                                </button>
                            </div>
                        ) : pendingPhotos.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '80px 0' }}>
                                <ImageIcon size={48} style={{ margin: '0 auto 20px auto', color: '#ccc' }} />
                                <h3 style={{ fontSize: '1.5rem', color: '#666', marginBottom: '10px' }}>Aucune photo en attente</h3>
                                <p style={{ color: '#888' }}>Tout est calme pour le moment.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                                {pendingPhotos.map(photo => (
                                    <div key={photo.id} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', backgroundColor: 'white' }}>
                                        <div style={{ width: '100%', aspectRatio: '3/4', position: 'relative' }}>
                                            <img
                                                src={photoUrl(photo.storage_path)}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                alt="Guest upload"
                                            />
                                            {/* Action Overlay */}
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 15px 15px 15px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                                <button
                                                    onClick={() => moderatePhoto(photo.id, 'rejected')}
                                                    style={{ width: 45, height: 45, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', transition: '0.2s' }}
                                                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#ef4444'}
                                                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                                                >
                                                    <X size={20} />
                                                </button>
                                                <button
                                                    onClick={() => moderatePhoto(photo.id, 'approved')}
                                                    style={{ width: 45, height: 45, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', transition: '0.2s' }}
                                                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#A3B19C'}
                                                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                                                >
                                                    <Check size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'challenges' && (
                    <div style={{ maxWidth: 800, margin: '0 auto' }}>
                        <div className="price-card" style={{ padding: '30px', textAlign: 'left', marginBottom: '30px' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>Créer un nouveau défi</h3>
                            <form onSubmit={handleAddChallenge} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <input
                                    type="text"
                                    placeholder="Titre (ex: Photo de toute la table)"
                                    style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#FAFAFA' }}
                                    value={newChallengeTitle}
                                    onChange={e => setNewChallengeTitle(e.target.value)}
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Description optionnelle"
                                    style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #ddd', backgroundColor: '#FAFAFA' }}
                                    value={newChallengeDesc}
                                    onChange={e => setNewChallengeDesc(e.target.value)}
                                />
                                <button type="submit" className="btn-rose-primary" style={{ alignSelf: 'flex-start' }}>Ajouter ce défi</button>
                            </form>
                        </div>

                        <h3 style={{ fontSize: '1.5rem', fontFamily: '"Cormorant Garamond", serif', color: '#222', marginBottom: '20px' }}>Défis existants</h3>
                        {challenges.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#888', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '12px' }}>
                                Vous n'avez pas encore créé de défi.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {challenges.map(c => (
                                    <div key={c.id} className="price-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', borderLeft: c.is_active ? '4px solid #D4AF37' : 'none' }}>
                                        <div>
                                            <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: c.is_active ? '#D4AF37' : '#222' }}>{c.title}</h4>
                                            {c.description && <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '5px' }}>{c.description}</p>}
                                        </div>
                                        <button
                                            onClick={() => toggleChallenge(c.id, c.is_active)}
                                            style={{
                                                padding: '8px 16px',
                                                borderRadius: '50px',
                                                border: c.is_active ? '1px solid #D4AF37' : '1px solid #ccc',
                                                backgroundColor: c.is_active ? '#D4AF37' : 'transparent',
                                                color: c.is_active ? 'white' : '#666',
                                                cursor: 'pointer',
                                                transition: '0.2s',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            {c.is_active ? 'Actif' : 'Activer'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'photos' && (
                    <PhotosTab event={event} onChanged={() => fetchPublicEvent(slug).then(e => setPhotoCount(e?.photo_count ?? 0))} />
                )}
                {activeTab === 'kit' && (
                    <div style={{ maxWidth: 800, margin: '0 auto' }}>
                        <div className="price-card" style={{ padding: '50px', textAlign: 'center' }}>
                            {/* Aperçu réel du chevalet (même contenu que la page d'impression) */}
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
                                <div style={{ width: '100%', maxWidth: 340, padding: '28px 20px', background: '#F9F5F0', border: '3px solid #D4AF37', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                                    <p style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.8rem', color: '#D4AF37', margin: '0 0 6px 0', overflowWrap: 'anywhere' }}>{event.name}</p>
                                    <p style={{ color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '0.7rem', margin: '0 0 16px 0' }}>Scannez pour participer</p>
                                    {qrCodeUrl
                                        ? <img src={qrCodeUrl} alt="QR code de votre événement" style={{ width: 170, height: 170, background: 'white', padding: 10, borderRadius: 10 }} />
                                        : <div style={{ width: 170, height: 170, margin: '0 auto', background: 'white', borderRadius: 10 }} />}
                                    <p style={{ color: '#333', fontSize: '0.95rem', margin: '14px 0 0 0' }}>Partagez vos photos en direct !</p>
                                </div>
                            </div>

                            <h3 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2rem', color: '#222', marginBottom: '15px' }}>Chevalets de Table</h3>
                            <p style={{ color: '#666', marginBottom: '30px', maxWidth: 500, margin: '0 auto 30px auto', lineHeight: 1.6 }}>
                                Téléchargez et imprimez vos chevalets pour aider vos invités à se connecter.
                                <br />Format A4 (Paysage) : Coupez au milieu pour obtenir 2 chevalets.
                            </p>

                            {qrCodeUrl && event && (
                                <a
                                    href={`/admin/${event.slug}/print`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-gold"
                                    style={{ padding: '15px 30px', borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
                                >
                                    <Printer size={20} />
                                    Imprimer les Chevalets
                                </a>
                            )}

                            <div style={{ marginTop: '40px', paddingTop: '40px', borderTop: '1px solid #eee', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', fontSize: '0.9rem', color: '#888' }}>
                                <div>
                                    <span style={{ display: 'block', fontWeight: 'bold', color: '#222', marginBottom: '5px' }}>1. Imprimez</span>
                                    Sur du papier cartonné si possible
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontWeight: 'bold', color: '#222', marginBottom: '5px' }}>2. Coupez</span>
                                    Une feuille A4 = 2 Chevalets
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontWeight: 'bold', color: '#222', marginBottom: '5px' }}>3. Pliez</span>
                                    Posez-les sur les tables !
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
