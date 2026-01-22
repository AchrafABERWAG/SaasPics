'use client';

import { useState, use, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Trash2, Download, CheckCircle, Image as ImageIcon, Play } from 'lucide-react';
import Link from 'next/link';
import { Photo, Event, Challenge } from '@/types';
import toast from 'react-hot-toast';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { div, main } from 'framer-motion/client';

// Properly type the params for Next.js 15+ App Router
type Params = Promise<{ slug: string }>;

export default function AdminPage({ params }: { params: Params }) {
    const { slug } = use(params);

    // Auth State
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passcodeInput, setPasscodeInput] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    // Data State
    const [event, setEvent] = useState<Event | null>(null);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);



    // Action State
    const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [isZipping, setIsZipping] = useState(false);

    // Challenge State
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [newChallengeTitle, setNewChallengeTitle] = useState('');
    const [newChallengeDesc, setNewChallengeDesc] = useState('');

    useEffect(() => {
        if (isAuthenticated && event) {
            fetchChallenges();
        }
    }, [isAuthenticated, event]);

    const fetchChallenges = async () => {
        if (!event) return;
        const { data } = await supabase
            .from('challenges')
            .select('*')
            .eq('event_id', event.id)
            .order('created_at', { ascending: false });
        if (data) setChallenges(data as Challenge[]);
    };

    const handleAddChallenge = async () => {
        if (!newChallengeTitle.trim() || !event) return;

        const { error } = await supabase.from('challenges').insert({
            event_id: event.id,
            title: newChallengeTitle,
            description: newChallengeDesc,
            is_active: false
        });

        if (error) toast.error('Erreur création challenge');
        else {
            toast.success('Challenge créé !');
            setNewChallengeTitle('');
            setNewChallengeDesc('');
            fetchChallenges();
        }
    };

    const toggleChallenge = async (id: string, currentStatus: boolean) => {
        // If activating, deactivate others
        if (!currentStatus && event) {
            await supabase.from('challenges').update({ is_active: false }).eq('event_id', event.id);
        }

        const { error } = await supabase
            .from('challenges')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (error) toast.error('Erreur update');
        else {
            toast.success('Statut mis à jour');
            fetchChallenges();
        }
    };

    const handleDeleteChallenge = async (id: string) => {
        if (!confirm('Supprimer ce challenge ?')) return;
        const { error } = await supabase.from('challenges').delete().eq('id', id);
        if (error) toast.error('Erreur suppression');
        else {
            toast.success('Supprimé');
            fetchChallenges();
        }
    };



    // 1. Initial Fetch of Event (Check if exists)
    useEffect(() => {
        async function fetchEvent() {
            const { data, error } = await supabase
                .from('events')
                .select('*') // We need 'passcode' here to verify
                .eq('slug', slug)
                .single();

            if (data) {
                setEvent(data as Event);
            }
            setLoading(false);
        }
        fetchEvent();
    }, [slug]);

    // 2. Fetch Photos (Only if authenticated)
    useEffect(() => {
        if (isAuthenticated && event) {
            fetchPhotos();
        }
    }, [isAuthenticated, event]);

    const fetchPhotos = async () => {
        if (!event) return;
        const { data } = await supabase
            .from('photos')
            .select('*')
            .eq('event_id', event.id)
            .order('created_at', { ascending: false });

        if (data) setPhotos(data as Photo[]);

    };



    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!event || !event.passcode) return;

        setIsVerifying(true);
        if (passcodeInput === event.passcode) {
            setIsAuthenticated(true);
            toast.success('Connexion réussie !');
        } else {
            toast.error('Mot de passe incorrect.');
        }
        setIsVerifying(false);
    };

    const handleDelete = async () => {
        if (selectedPhotos.size === 0) return;
        if (!confirm(`Supprimer définitivement ${selectedPhotos.size} photo(s) ?`)) return;

        setIsDeleting(true);
        const toDelete = Array.from(selectedPhotos);

        // 1. Delete from Storage
        const paths = photos
            .filter(p => toDelete.includes(p.id))
            .map(p => p.storage_path);

        const { error: storageError } = await supabase.storage
            .from('photos')
            .remove(paths);

        if (storageError) {
            toast.error('Erreur supression stockage');
            setIsDeleting(false);
            return;
        }

        // 2. Delete from DB
        const { error: dbError } = await supabase
            .from('photos')
            .delete()
            .in('id', toDelete);

        if (!dbError) {
            toast.success('Photos supprimées.');
            setSelectedPhotos(new Set());
            fetchPhotos(); // Refresh
        } else {
            toast.error('Erreur suppression base de données');
        }
        setIsDeleting(false);
    };

    const handleDownloadZip = async () => {
        setIsZipping(true);
        const zip = new JSZip();
        const folder = zip.folder(`photos-${slug}`);

        try {
            toast.loading('Préparation du téléchargement...', { id: 'zip' });

            // Fetch all photos in parallel
            const promises = photos.map(async (photo) => {
                const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${photo.storage_path}`;
                const response = await fetch(url);
                const blob = await response.blob();
                folder?.file(`photo-${photo.created_at || photo.id}.jpg`, blob);
            });

            await Promise.all(promises);

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `mariage-${slug}.zip`);
            toast.success('Téléchargement lancé !', { id: 'zip' });

        } catch (err) {
            console.error(err);
            toast.error('Erreur lors de la création du ZIP', { id: 'zip' });
        } finally {
            setIsZipping(false);
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedPhotos);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPhotos(newSet);
    };

    // --- RENDERS ---

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Chargement...</div>;
    if (!event) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Événement introuvable</div>;

    // 1. Login Screen (Luxury Redesign - Manual CSS)
    if (!isAuthenticated) {
        return (
            <div className="login-container">
                {/* Background */}
                <div className="login-bg">
                    <img
                        src="https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop"
                        alt="Wedding Background"
                    />
                    <div className="login-overlay" />
                </div>

                {/* Glass Card */}
                <div className="glass-panel login-card">
                    {/* Ring Icon */}
                    <div style={{ color: 'var(--gold-primary)', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                            <circle cx="9" cy="12" r="5" />
                            <circle cx="15" cy="12" r="5" />
                            <path d="M15 7l-2-2" />
                            <path d="M9 7l2-2" />
                        </svg>
                    </div>

                    <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.5rem', marginBottom: '5px' }}>
                        Espace Mariés
                    </h1>
                    <p style={{ textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.8rem', opacity: 0.7, marginBottom: '30px' }}>
                        {event.name}
                    </p>

                    <form onSubmit={handleLogin}>
                        <input
                            type="password"
                            placeholder="CODE SECRET"
                            value={passcodeInput}
                            onChange={(e) => setPasscodeInput(e.target.value)}
                            className="login-input"
                        />

                        <button
                            type="submit"
                            disabled={isVerifying}
                            className="btn-gold"
                            style={{ width: '100%', padding: '16px', borderRadius: '12px', fontSize: '1rem' }}
                        >
                            {isVerifying ? <Loader2 className="animate-spin" style={{ margin: '0 auto' }} /> : 'ACCÉDER À LA GALERIE'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 2. Dashboard Render (Manual CSS)
    return (
        <div className="admin-container">
            {/* Header */}
            <header className="admin-header glass-panel">
                <div>
                    <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.8rem', color: 'var(--gold-primary)' }}>
                        Dashboard Admin
                    </h1>
                    <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.6 }}>
                        {event.name}  •  {photos.length} Photos
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    {/* Slideshow Button */}
                    <Link href={`/event/${slug}/slideshow`}>
                        <button
                            className="btn-icon"
                            style={{ borderColor: 'var(--gold-primary)', color: 'var(--gold-primary)' }}
                        >
                            <Play size={16} />
                            Lancer Diaporama
                        </button>
                    </Link>
                    {selectedPhotos.size > 0 ? (
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="btn-icon"
                            style={{ borderColor: '#EF4444', color: '#EF4444' }}
                        >
                            <Trash2 size={16} />
                            Supprimer ({selectedPhotos.size})
                        </button>
                    ) : (
                        <button
                            onClick={handleDownloadZip}
                            disabled={isZipping || photos.length === 0}
                            className="btn-gold"
                            style={{ padding: '10px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {isZipping ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                            Tout Télécharger (ZIP)
                        </button>
                    )}
                </div>
            </header>

            {/* Content Content source of truth */}
            <main className="admin-content">
                {/* Stats */}
                <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'inline-flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '50%', color: 'var(--gold-primary)' }}>
                        <ImageIcon size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.6 }}>Total Photos</p>
                        <p style={{ fontSize: '1.5rem', fontFamily: 'Cormorant Garamond, serif' }}>{photos.length}</p>
                    </div>
                </div>

                {/* Grid */}
                <div className="admin-grid">
                    {photos.map((photo) => {
                        const isSelected = selectedPhotos.has(photo.id);
                        return (
                            <div
                                key={photo.id}
                                onClick={() => toggleSelection(photo.id)}
                                className={`admin-card ${isSelected ? 'selected' : ''}`}
                            >
                                <img
                                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${photo.storage_path}`}
                                    loading="lazy"
                                />

                                <div className="card-overlay">
                                    {isSelected && <CheckCircle size={32} color="var(--gold-primary)" />}
                                </div>
                            </div>
                        );
                    })}
                </div>






                {
                    photos.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                            <p>La galerie est vide pour le moment.</p>
                        </div>
                    )
                }

                {/* --- Challenge Manager Section V2 --- */}
                <div className="challenge-manager">
                    <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', marginBottom: '20px', color: 'var(--gold-primary)' }}>
                        Gestion des Défis
                    </h2>

                    {/* Form */}
                    <div className="challenge-form">
                        <div className="challenge-input-row">
                            <input
                                type="text"
                                placeholder="Titre du défi (ex: Selfie avec la mariée)"
                                className="challenge-input"
                                style={{ flex: 2, fontWeight: 'bold' }}
                                value={newChallengeTitle}
                                onChange={e => setNewChallengeTitle(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Description (optionnelle)"
                                className="challenge-input"
                                style={{ flex: 3 }}
                                value={newChallengeDesc}
                                onChange={e => setNewChallengeDesc(e.target.value)}
                            />
                            <button
                                className="btn-gold"
                                style={{ borderRadius: '8px', padding: '0 25px' }}
                                onClick={handleAddChallenge}
                            >
                                Ajouter
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="challenge-list">
                        {challenges.map(c => (
                            <div key={c.id} className={`challenge-item ${c.is_active ? 'active' : ''}`}>
                                <div className="challenge-info">
                                    <h3>
                                        {c.title}
                                        <span className={`challenge-status ${c.is_active ? 'active' : ''}`}>
                                            {c.is_active ? 'ACTIF' : 'INACTIF'}
                                        </span>
                                    </h3>
                                    {c.description && <p>{c.description}</p>}
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        className="btn-icon"
                                        onClick={() => toggleChallenge(c.id, c.is_active)}
                                        style={c.is_active ? { borderColor: 'var(--gold-primary)', color: 'var(--gold-primary)' } : {}}
                                    >
                                        {c.is_active ? 'Désactiver' : 'Activer'}
                                    </button>
                                    <button
                                        className="btn-icon"
                                        style={{ borderColor: '#EF4444', color: '#EF4444' }}
                                        onClick={() => handleDeleteChallenge(c.id)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {challenges.length === 0 && <p style={{ opacity: 0.5, fontStyle: 'italic' }}>Aucun défi pour le moment.</p>}
                    </div>
                </div>
            </main >
        </div >
    );
}
