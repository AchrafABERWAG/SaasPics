'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Trash2, CheckSquare, Square, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { photoUrl } from '@/lib/events';
import { PLANS } from '@/lib/plans';
import type { Event, Photo } from '@/types';

const PAGE = 60;
const ZIP_CONCURRENCY = 6;
type Filter = 'all' | Photo['status'];

const STATUS_LABEL: Record<Photo['status'], string> = { approved: 'Publiée', pending: 'En attente', rejected: 'Refusée' };

// Toutes les photos de l'événement (RLS : visibles par l'admin uniquement), suppression et export ZIP.
export default function PhotosTab({ event, onChanged }: { event: Event; onChanged?: () => void }) {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>('all');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);

    const load = useCallback(async (before?: string) => {
        let query = supabase.from('photos').select('*').eq('event_id', event.id)
            .order('created_at', { ascending: false }).limit(PAGE);
        if (filter !== 'all') query = query.eq('status', filter);
        if (before) query = query.lt('created_at', before);
        const { data, error } = await query;
        if (error) { toast.error('Impossible de charger les photos.'); return; }
        const page = (data as Photo[]) ?? [];
        setPhotos(prev => (before ? [...prev, ...page] : page));
        setHasMore(page.length === PAGE);
    }, [event.id, filter]);

    useEffect(() => {
        setLoading(true);
        setSelected(new Set());
        load().finally(() => setLoading(false));
    }, [load]);

    const toggle = (id: string) => setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    async function deleteSelected() {
        const toDelete = photos.filter(p => selected.has(p.id));
        if (toDelete.length === 0) return;
        if (!confirm(`Supprimer définitivement ${toDelete.length} photo${toDelete.length > 1 ? 's' : ''} ? Cette action est irréversible.`)) return;

        setDeleting(true);
        try {
            const { error: storageErr } = await supabase.storage.from('photos').remove(toDelete.map(p => p.storage_path));
            if (storageErr) throw storageErr;
            const { error: dbErr } = await supabase.from('photos').delete().in('id', toDelete.map(p => p.id));
            if (dbErr) throw dbErr;
            setPhotos(prev => prev.filter(p => !selected.has(p.id)));
            setSelected(new Set());
            toast.success(`${toDelete.length} photo${toDelete.length > 1 ? 's supprimées' : ' supprimée'}.`);
            onChanged?.();
        } catch (err) {
            console.error('Delete photos error:', err);
            toast.error('La suppression a échoué.');
        } finally {
            setDeleting(false);
        }
    }

    async function downloadZip() {
        // Toutes les photos publiées (pas seulement la page affichée).
        const all: Photo[] = [];
        let before: string | undefined;
        for (;;) {
            let query = supabase.from('photos').select('*').eq('event_id', event.id).eq('status', 'approved')
                .order('created_at', { ascending: false }).limit(500);
            if (before) query = query.lt('created_at', before);
            const { data, error } = await query;
            if (error) { toast.error('Impossible de préparer le téléchargement.'); return; }
            all.push(...((data as Photo[]) ?? []));
            if (!data || data.length < 500) break;
            before = data[data.length - 1].created_at;
        }
        if (all.length === 0) { toast('Aucune photo publiée à télécharger.'); return; }

        const [{ default: JSZip }, { saveAs }] = await Promise.all([import('jszip'), import('file-saver')]);
        const zip = new JSZip();
        let done = 0;
        let failed = 0;
        setZipProgress({ done: 0, total: all.length });

        const queue = all.map((photo, index) => ({ photo, index }));
        await Promise.all(Array.from({ length: ZIP_CONCURRENCY }, async () => {
            for (let item = queue.shift(); item; item = queue.shift()) {
                try {
                    const res = await fetch(photoUrl(item.photo.storage_path));
                    if (!res.ok) throw new Error(String(res.status));
                    const ext = item.photo.storage_path.split('.').pop() || 'jpg';
                    zip.file(`photo-${String(item.index + 1).padStart(4, '0')}.${ext}`, await res.blob());
                } catch {
                    failed++;
                }
                setZipProgress({ done: ++done, total: all.length });
            }
        }));

        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, `${event.slug}-photos.zip`);
        setZipProgress(null);
        if (failed) toast.error(`${failed} photo${failed > 1 ? 's n’ont' : ' n’a'} pas pu être ajoutée${failed > 1 ? 's' : ''} au ZIP.`);
        else toast.success('Téléchargement prêt.');
    }

    const canZip = PLANS[event.plan_type].zipDownload;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(['all', 'approved', 'pending', 'rejected'] as Filter[]).map(f => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            className="btn-sage-outline sm"
                            style={{ opacity: filter === f ? 1 : 0.55 }}
                        >
                            {f === 'all' ? 'Toutes' : STATUS_LABEL[f]}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selected.size > 0 && (
                        <button type="button" onClick={deleteSelected} disabled={deleting} className="btn-rose-primary sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            Supprimer ({selected.size})
                        </button>
                    )}
                    {photos.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSelected(selected.size === photos.length ? new Set() : new Set(photos.map(p => p.id)))}
                            className="btn-sage-outline sm"
                        >
                            {selected.size === photos.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={canZip ? downloadZip : undefined}
                        disabled={!canZip || zipProgress !== null}
                        title={canZip ? undefined : 'Inclus dans les packs Essentiel et Premium'}
                        className="btn-sage-primary sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: canZip ? 1 : 0.5 }}
                    >
                        {zipProgress ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        {zipProgress
                            ? `Préparation ${zipProgress.done}/${zipProgress.total}`
                            : canZip ? 'Télécharger tout (ZIP HD)' : 'ZIP HD (packs payants)'}
                    </button>
                </div>
            </div>

            {loading ? (
                <p style={{ textAlign: 'center', color: '#888', padding: '60px 0' }}>Chargement...</p>
            ) : photos.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888', padding: '60px 0' }}>Aucune photo pour le moment.</p>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                        {photos.map(photo => {
                            const isSelected = selected.has(photo.id);
                            return (
                                <button
                                    key={photo.id}
                                    type="button"
                                    onClick={() => toggle(photo.id)}
                                    aria-pressed={isSelected}
                                    style={{
                                        position: 'relative', padding: 0, border: isSelected ? '3px solid #D4AF37' : '3px solid transparent',
                                        borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', background: '#eee', aspectRatio: '1',
                                    }}
                                >
                                    <img src={photoUrl(photo.storage_path)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    <span style={{ position: 'absolute', top: 6, left: 6, color: 'white', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>
                                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                    </span>
                                    {photo.status !== 'approved' && (
                                        <span style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4 }}>
                                            {STATUS_LABEL[photo.status]}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {hasMore && (
                        <div style={{ textAlign: 'center', marginTop: '24px' }}>
                            <button type="button" className="btn-sage-outline sm" onClick={() => load(photos[photos.length - 1].created_at)}>
                                Charger plus
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
