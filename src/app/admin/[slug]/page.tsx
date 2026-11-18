'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Check, X, Settings, Image as ImageIcon, Shield, Printer, Play, Zap } from 'lucide-react';
import { Photo, Challenge, Event } from '@/types';
import { fetchPublicEvent, friendlyDbError, photoUrl } from '@/lib/events';
import QRCode from 'qrcode';

import LoginAdmin from '@/components/auth/LoginAdmin';

type Params = Promise<{ slug: string }>;

const PLAN_LABELS: Record<Event['plan_type'], string> = {
    discovery: 'Découverte (gratuit)',
    essential: 'Essentiel',
    premium: 'Premium',
};

export default function AdminPage({ params }: { params: Params }) {
    const { slug } = use(params);
    const [event, setEvent] = useState<Event | null>(null);
    const [eventExists, setEventExists] = useState(true);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'settings' | 'moderation' | 'kit' | 'challenges'>('moderation');
    const [pendingPhotos, setPendingPhotos] = useState<Photo[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
    const [newChallengeTitle, setNewChallengeTitle] = useState('');
    const [newChallengeDesc, setNewChallengeDesc] = useState('');

    // Form Data (le pack n'est pas modifiable ici : il change uniquement après paiement)
    const [formData, setFormData] = useState({
        bride_name: '',
        groom_name: '',
        moderation_enabled: false
    });

    useEffect(() => {
        checkAuthAndFetch();
    }, [slug]);

    async function checkAuthAndFetch() {
        setLoading(true);
        const publicEvent = await fetchPublicEvent(slug).catch(() => null);
        setEventExists(!!publicEvent);
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
            const url = `${window.location.origin}/event/${event.slug}`;
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
                    <div className="nav-logo">
                        <span className="logo-text">Lumina Admin</span>
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
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
                            Voir le Live
                        </a>
                        <a href={`/event/${slug}/slideshow`} target="_blank" style={{ color: '#D4AF37', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Play size={14} fill="#D4AF37" /> Diaporama
                        </a>
                    </div>
                </div>
            </nav>

            <div className="pricing-page-container" style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto', flex: 1, width: '100%' }}>
                <header style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 className="hero-title" style={{ fontSize: '3rem', marginBottom: '10px' }}>
                        <span className="serif-highlight">{event.name}</span>
                    </h1>
                    <p style={{ color: '#888', letterSpacing: 2, textTransform: 'uppercase', fontSize: '0.8rem' }}>
                        {activeTab === 'moderation' ? 'Gérez les photos en attente' : 'Configurez votre événement'}
                    </p>
                </header>

                {activeTab === 'settings' && (
                    <form onSubmit={updateEvent} style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        {/* Toggle Moderation */}
                        <div className="price-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '30px', textAlign: 'left' }}>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '5px' }}>Mode Modération</h3>
                                <p style={{ color: '#666', fontSize: '0.9rem' }}>Si activé, les photos doivent être approuvées.</p>
                            </div>
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
                            <p style={{ fontSize: '1.1rem', color: '#222' }}>{PLAN_LABELS[event.plan_type]}</p>
                            {event.expires_at && (
                                <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '5px' }}>
                                    Galerie disponible jusqu&apos;au {new Date(event.expires_at).toLocaleDateString('fr-FR')}
                                </p>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                            <button type="submit" className="btn-rose-primary" style={{ minWidth: 200 }}>Sauvegarder</button>
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
                                        setFormData({ ...formData, moderation_enabled: true });
                                        setActiveTab('settings');
                                    }}
                                    style={{ marginTop: '20px', color: '#A3B19C', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                                >
                                    Activer la modération dans les réglages
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
                {activeTab === 'kit' && (
                    <div style={{ maxWidth: 800, margin: '0 auto' }}>
                        <div className="price-card" style={{ padding: '50px', textAlign: 'center' }}>
                            {/* Mockup Preview */}
                            <div style={{ width: '100%', backgroundColor: '#F9F5F0', borderRadius: '16px', overflow: 'hidden', marginBottom: '30px', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                                <img
                                    src="/brain/4a74d474-80cf-4bae-876b-f68e8a8a4aea/table_card_mockup_1769446290768.png"
                                    style={{ width: '100%', height: 'auto', display: 'block', transition: 'transform 0.5s' }}
                                    alt="Aperçu Chevalet"
                                    onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                    onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                />
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
