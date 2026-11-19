'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, X } from 'lucide-react';
import { PublicEvent, PublicPhoto } from '@/types';
import { fetchApprovedPhotos, fetchPublicEvent, photoUrl, subscribeToApprovedPhotos, uploadBlockReason } from '@/lib/events';

type Params = Promise<{ slug: string }>;
const PAGE = 60;

export default function GalleryPage({ params }: { params: Params }) {
    const { slug } = use(params);
    const [event, setEvent] = useState<PublicEvent | null>(null);
    const [photos, setPhotos] = useState<PublicPhoto[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [state, setState] = useState<'loading' | 'ready' | 'not_found'>('loading');
    const [loadingMore, setLoadingMore] = useState(false);
    const [opened, setOpened] = useState<PublicPhoto | null>(null);

    useEffect(() => {
        (async () => {
            const ev = await fetchPublicEvent(slug).catch(() => null);
            if (!ev) { setState('not_found'); return; }
            setEvent(ev);
            const first = await fetchApprovedPhotos(ev.id, PAGE).catch(() => []);
            setPhotos(first);
            setHasMore(first.length === PAGE);
            setState('ready');
        })();
    }, [slug]);

    // Nouvelles photos en direct (et retrait des photos supprimées / refusées).
    useEffect(() => {
        if (!event) return;
        return subscribeToApprovedPhotos(event.id, (photo, visible) => {
            setPhotos(prev => {
                const without = prev.filter(p => p.id !== photo.id);
                return visible ? [photo, ...without] : without;
            });
        });
    }, [event]);

    useEffect(() => {
        if (!opened) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpened(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [opened]);

    async function loadMore() {
        if (!event || photos.length === 0) return;
        setLoadingMore(true);
        const next = await fetchApprovedPhotos(event.id, PAGE, photos[photos.length - 1].created_at).catch(() => []);
        setPhotos(prev => [...prev, ...next.filter(n => !prev.some(p => p.id === n.id))]);
        setHasMore(next.length === PAGE);
        setLoadingMore(false);
    }

    if (state === 'loading') {
        return <div style={screen}><Loader2 className="animate-spin" size={40} /></div>;
    }
    if (state === 'not_found' || !event) {
        return <div style={screen}>Événement introuvable.</div>;
    }

    const closed = uploadBlockReason(event) === 'closed';

    return (
        <main style={{ minHeight: '100vh', background: '#111', color: 'white', padding: '24px 16px 48px' }}>
            <header style={{ maxWidth: 1100, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <Link href={`/event/${slug}`} style={{ color: '#ccc', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                    <ArrowLeft size={18} /> {closed ? 'Retour' : 'Ajouter une photo'}
                </Link>
                <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2rem', margin: 0, color: '#D4AF37', textAlign: 'center', flex: 1 }}>
                    {event.name}
                </h1>
                <span style={{ color: '#888', fontSize: '0.9rem', minWidth: 80, textAlign: 'right' }}>
                    {photos.length}{hasMore ? '+' : ''} photo{photos.length > 1 ? 's' : ''}
                </span>
            </header>

            {photos.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#aaa', marginTop: 80 }}>
                    {closed ? 'La galerie de cet événement est fermée.' : 'Aucune photo pour le moment. Soyez le premier à partager un souvenir !'}
                </p>
            ) : (
                <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {photos.map(photo => (
                        <button
                            key={photo.id}
                            type="button"
                            onClick={() => setOpened(photo)}
                            style={{ padding: 0, border: 'none', borderRadius: 8, overflow: 'hidden', aspectRatio: '1', cursor: 'zoom-in', background: '#222' }}
                        >
                            <img src={photoUrl(photo.storage_path)} alt={photo.caption || 'Photo d’un invité'} loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </button>
                    ))}
                </div>
            )}

            {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-gold" style={{ padding: '12px 24px', borderRadius: 50 }}>
                        {loadingMore ? 'Chargement…' : 'Voir plus de photos'}
                    </button>
                </div>
            )}

            {opened && (
                <div
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setOpened(null)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
                >
                    <button type="button" aria-label="Fermer" onClick={() => setOpened(null)}
                        style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                        <X size={28} />
                    </button>
                    <img src={photoUrl(opened.storage_path)} alt={opened.caption || 'Photo d’un invité'}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
                </div>
            )}
        </main>
    );
}

const screen: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', color: 'white',
};
