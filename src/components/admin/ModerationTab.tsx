'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Shield, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { friendlyDbError, photoUrl, thumbUrl } from '@/lib/events';
import type { Event, Photo } from '@/types';

// Photos en attente de validation (pack Premium, modération activée).
export default function ModerationTab({ event, onOpenSettings }: {
    event: Pick<Event, 'id' | 'moderation_enabled'>;
    onOpenSettings: () => void;
}) {
    const [pending, setPending] = useState<Photo[]>([]);
    const [loaded, setLoaded] = useState(false);

    const load = useCallback(async () => {
        const { data, error } = await supabase
            .from('photos')
            .select('*')
            .eq('event_id', event.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });
        if (error) toast.error('Impossible de charger les photos en attente.');
        else setPending((data as Photo[]) ?? []);
        setLoaded(true);
    }, [event.id]);

    useEffect(() => {
        if (!event.moderation_enabled) return;
        // load() ne met l'état à jour qu'après la requête (asynchrone).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load();
        const channel = supabase
            .channel(`admin-moderation:${event.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'photos', filter: `event_id=eq.${event.id}` }, () => load())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [event.id, event.moderation_enabled, load]);

    async function moderate(photo: Photo, status: 'approved' | 'rejected') {
        setPending(prev => prev.filter(p => p.id !== photo.id));
        const { error } = await supabase.from('photos').update({ status }).eq('id', photo.id);
        if (error) {
            toast.error(friendlyDbError(error.message));
            setPending(prev => [photo, ...prev.filter(p => p.id !== photo.id)]);
        } else {
            toast.success(status === 'approved' ? 'Photo publiée' : 'Photo refusée', { id: 'moderation' });
        }
    }

    if (!event.moderation_enabled) {
        return (
            <div className="empty-state">
                <Shield size={44} />
                <h3>La modération est désactivée</h3>
                <p>Les photos de vos invités sont publiées automatiquement.</p>
                <button type="button" className="link-button" onClick={onOpenSettings}>Activer la modération dans la configuration</button>
            </div>
        );
    }
    if (loaded && pending.length === 0) {
        return (
            <div className="empty-state">
                <ImageIcon size={44} />
                <h3>Aucune photo en attente</h3>
                <p>Les nouvelles photos apparaîtront ici automatiquement.</p>
            </div>
        );
    }

    return (
        <>
            <p className="admin-hint center">{pending.length} photo{pending.length > 1 ? 's' : ''} en attente, de la plus ancienne à la plus récente.</p>
            <div className="moderation-grid">
                {pending.map(photo => (
                    <div key={photo.id} className="moderation-card">
                        <a href={photoUrl(photo.storage_path)} target="_blank" rel="noopener noreferrer">
                            <img src={thumbUrl(photo)} alt={photo.caption || 'Photo en attente'} loading="lazy" />
                        </a>
                        {(photo.guest_name || photo.caption) && (
                            <p className="moderation-caption">
                                {photo.guest_name && <strong>{photo.guest_name}</strong>}
                                {photo.guest_name && photo.caption && ' — '}
                                {photo.caption}
                            </p>
                        )}
                        <div className="moderation-actions">
                            <button type="button" className="mod-btn reject" onClick={() => moderate(photo, 'rejected')}>
                                <X size={18} /> Refuser
                            </button>
                            <button type="button" className="mod-btn approve" onClick={() => moderate(photo, 'approved')}>
                                <Check size={18} /> Publier
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
