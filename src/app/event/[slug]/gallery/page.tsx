'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { PublicEvent, PublicPhoto } from '@/types';
import { fetchApprovedPhotos, fetchPublicEvent, photoUrl, subscribeToApprovedPhotos, thumbUrl, uploadBlockReason } from '@/lib/events';
import { forgetOwnUpload, loadOwnUploads, type OwnUpload } from '@/lib/upload';
import { useConfirm } from '@/components/ui/ConfirmDialog';

type Params = Promise<{ slug: string }>;
const PAGE = 60;

export default function GalleryPage({ params }: { params: Params }) {
    const { slug } = use(params);
    const [event, setEvent] = useState<PublicEvent | null>(null);
    const [photos, setPhotos] = useState<PublicPhoto[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [state, setState] = useState<'loading' | 'ready' | 'not_found'>('loading');
    const [loadingMore, setLoadingMore] = useState(false);
    const [openedId, setOpenedId] = useState<string | null>(null);
    const [own, setOwn] = useState<OwnUpload[]>([]);

    const reloadFirstPage = useCallback(async (eventId: string) => {
        const first = await fetchApprovedPhotos(eventId, PAGE).catch(() => null);
        if (!first) return;
        setPhotos(prev => {
            // Garde les pages déjà chargées plus bas, sans doublon.
            const ids = new Set(first.map(p => p.id));
            return [...first, ...prev.filter(p => !ids.has(p.id) && p.created_at < first[first.length - 1]?.created_at)];
        });
    }, []);

    useEffect(() => {
        (async () => {
            const ev = await fetchPublicEvent(slug).catch(() => null);
            if (!ev) { setState('not_found'); return; }
            setEvent(ev);
            const first = await fetchApprovedPhotos(ev.id, PAGE).catch(() => []);
            setPhotos(first);
            setHasMore(first.length === PAGE);
            setOwn(loadOwnUploads().filter(u => u.eventId === ev.id));
            setState('ready');
        })();
    }, [slug]);

    // Nouvelles photos en direct (et retrait des photos supprimées / refusées) ; rattrapage
    // automatique après une coupure de réseau.
    useEffect(() => {
        if (!event) return;
        return subscribeToApprovedPhotos(
            event.id,
            (photo, visible) => setPhotos(prev => {
                const without = prev.filter(p => p.id !== photo.id);
                return visible ? [photo, ...without] : without;
            }),
            () => reloadFirstPage(event.id)
        );
    }, [event, reloadFirstPage]);

    async function loadMore() {
        if (!event || photos.length === 0) return;
        setLoadingMore(true);
        const next = await fetchApprovedPhotos(event.id, PAGE, photos[photos.length - 1].created_at).catch(() => []);
        setPhotos(prev => [...prev, ...next.filter(n => !prev.some(p => p.id === n.id))]);
        setHasMore(next.length === PAGE);
        setLoadingMore(false);
    }

    if (state === 'loading') return <div className="gallery-status"><Loader2 className="animate-spin" size={40} /></div>;
    if (state === 'not_found' || !event) return <div className="gallery-status">Événement introuvable.</div>;

    const closed = uploadBlockReason(event) === 'closed';
    const title = event.bride_name && event.groom_name ? `${event.bride_name} & ${event.groom_name}` : event.name;
    const openedIndex = photos.findIndex(p => p.id === openedId);

    return (
        <main className="gallery-page">
            <header className="gallery-header">
                <Link href={`/event/${slug}`} className="gallery-back">
                    <ArrowLeft size={18} /> {closed ? 'Retour' : 'Ajouter des photos'}
                </Link>
                <h1>{title}</h1>
                <span className="gallery-count">{photos.length}{hasMore ? '+' : ''} photo{photos.length > 1 ? 's' : ''}</span>
            </header>

            {photos.length === 0 ? (
                <div className="gallery-empty">
                    <p>{closed ? 'La galerie de cet événement est fermée.' : 'Aucune photo pour le moment.'}</p>
                    {!closed && <Link href={`/event/${slug}`} className="action-btn">Partager la première photo</Link>}
                </div>
            ) : (
                <div className="gallery-grid">
                    {photos.map(photo => (
                        <button key={photo.id} type="button" className="gallery-cell" onClick={() => setOpenedId(photo.id)}
                            aria-label={photo.guest_name ? `Photo de ${photo.guest_name}` : 'Ouvrir la photo'}>
                            <img src={thumbUrl(photo)} alt="" loading="lazy" decoding="async" />
                            {own.some(o => o.photoId === photo.id) && <span className="gallery-own-badge">Vous</span>}
                        </button>
                    ))}
                </div>
            )}

            {hasMore && (
                <div className="gallery-more">
                    <button type="button" onClick={loadMore} disabled={loadingMore} className="action-btn btn-secondary">
                        {loadingMore ? 'Chargement…' : 'Voir plus de photos'}
                    </button>
                </div>
            )}

            {openedIndex >= 0 && (
                <Lightbox
                    key={photos[openedIndex].id}
                    photo={photos[openedIndex]}
                    eventSlug={slug}
                    ownUpload={own.find(o => o.photoId === photos[openedIndex].id) ?? null}
                    onClose={() => setOpenedId(null)}
                    onPrev={openedIndex > 0 ? () => setOpenedId(photos[openedIndex - 1].id) : undefined}
                    onNext={openedIndex < photos.length - 1 ? () => setOpenedId(photos[openedIndex + 1].id) : undefined}
                    onDeleted={(id) => {
                        forgetOwnUpload(id);
                        setOwn(prev => prev.filter(o => o.photoId !== id));
                        setPhotos(prev => prev.filter(p => p.id !== id));
                        setOpenedId(null);
                    }}
                />
            )}
        </main>
    );
}

function Lightbox({ photo, eventSlug, ownUpload, onClose, onPrev, onNext, onDeleted }: {
    photo: PublicPhoto;
    eventSlug: string;
    ownUpload: OwnUpload | null;
    onClose: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    onDeleted: (id: string) => void;
}) {
    const [confirm, dialog] = useConfirm();
    const [busy, setBusy] = useState<'download' | 'delete' | null>(null);
    const [touchX, setTouchX] = useState<number | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') onPrev?.();
            if (e.key === 'ArrowRight') onNext?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, onPrev, onNext]);

    // Téléchargement en HD. Sur téléphone, la feuille de partage permet « Enregistrer l'image ».
    async function download() {
        setBusy('download');
        try {
            const res = await fetch(photoUrl(photo.storage_path));
            if (!res.ok) throw new Error(String(res.status));
            const blob = await res.blob();
            const name = `${eventSlug}-${photo.id.slice(0, 8)}.jpg`;
            const file = new File([blob], name, { type: 'image/jpeg' });
            if (navigator.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
                await navigator.share({ files: [file] }).catch(() => {});
            } else {
                const url = URL.createObjectURL(blob);
                const a = Object.assign(document.createElement('a'), { href: url, download: name });
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 10_000);
            }
        } catch {
            toast.error('Téléchargement impossible, réessayez.');
        } finally {
            setBusy(null);
        }
    }

    async function remove() {
        if (!ownUpload) return;
        if (!(await confirm({ title: 'Supprimer votre photo ?', message: 'Elle sera retirée de la galerie et du Mur Live.', confirmLabel: 'Supprimer', danger: true }))) return;
        setBusy('delete');
        try {
            const res = await fetch('/api/photos/delete-own', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoId: photo.id, token: ownUpload.token }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || 'Suppression impossible.');
            toast.success('Photo supprimée');
            onDeleted(photo.id);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Suppression impossible.');
            setBusy(null);
        }
    }

    return (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}
            onTouchStart={e => setTouchX(e.touches[0].clientX)}
            onTouchEnd={e => {
                if (touchX === null) return;
                const dx = e.changedTouches[0].clientX - touchX;
                if (dx > 60) onPrev?.();
                if (dx < -60) onNext?.();
                setTouchX(null);
            }}>
            {dialog}
            <button type="button" className="lightbox-close" aria-label="Fermer" onClick={onClose}><X size={28} /></button>
            {onPrev && <button type="button" className="lightbox-nav prev" aria-label="Photo précédente" onClick={e => { e.stopPropagation(); onPrev(); }}><ChevronLeft size={32} /></button>}
            {onNext && <button type="button" className="lightbox-nav next" aria-label="Photo suivante" onClick={e => { e.stopPropagation(); onNext(); }}><ChevronRight size={32} /></button>}

            {/* La miniature s'affiche tout de suite, la photo HD la remplace dès qu'elle est chargée. */}
            <img className="lightbox-img" src={photoUrl(photo.storage_path)} alt={photo.caption || 'Photo d’un invité'}
                style={{ backgroundImage: `url(${thumbUrl(photo)})` }} onClick={e => e.stopPropagation()} />

            <div className="lightbox-footer" onClick={e => e.stopPropagation()}>
                {(photo.guest_name || photo.caption) && (
                    <p className="lightbox-caption">
                        {photo.caption && <span>« {photo.caption} »</span>}
                        {photo.guest_name && <strong>{photo.guest_name}</strong>}
                    </p>
                )}
                <div className="lightbox-actions">
                    <button type="button" onClick={download} disabled={busy !== null}>
                        {busy === 'download' ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />} Télécharger
                    </button>
                    {ownUpload && (
                        <button type="button" onClick={remove} disabled={busy !== null} className="danger">
                            <Trash2 size={16} /> Supprimer ma photo
                        </button>
                    )}
                </div>
                {!ownUpload && <ReportPhoto key={photo.id} photoId={photo.id} />}
            </div>
        </div>
    );
}

const REPORT_REASONS = [
    'Je suis sur cette photo et je ne souhaite pas qu’elle soit publiée',
    'Contenu choquant, violent ou illicite',
    'Photo sans rapport avec l’événement',
];

// Signalement d'une photo (droit à l'image, contenu illicite) : prévient l'organisateur et l'équipe.
function ReportPhoto({ photoId }: { photoId: string }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState(REPORT_REASONS[0]);
    const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

    async function send() {
        setState('sending');
        try {
            const res = await fetch('/api/photos/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoId, reason }),
            });
            setState(res.ok ? 'done' : 'error');
        } catch {
            setState('error');
        }
    }

    if (state === 'done') return <p className="report-done">Merci, la photo a été signalée aux mariés.</p>;
    if (!open) return <button type="button" className="report-link" onClick={() => setOpen(true)}>Signaler cette photo</button>;
    return (
        <div className="report-box">
            <select value={reason} onChange={e => setReason(e.target.value)} aria-label="Motif du signalement">
                {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="button" onClick={send} disabled={state === 'sending'}>{state === 'sending' ? 'Envoi…' : 'Signaler'}</button>
            {state === 'error' && <span className="report-error">Échec, réessayez.</span>}
        </div>
    );
}
