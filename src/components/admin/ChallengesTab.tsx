'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trash2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { friendlyDbError } from '@/lib/events';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { Challenge } from '@/types';

const IDEAS = ['Un selfie avec les mariés', 'Toute la table sur une photo', 'Le plus beau fou rire', 'La piste de danse'];

// Défis photo (pack Premium) : un seul actif à la fois, affiché aux invités et sur le Mur Live.
export default function ChallengesTab({ eventId }: { eventId: string }) {
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [confirm, dialog] = useConfirm();

    const load = useCallback(async () => {
        const { data, error } = await supabase.from('challenges').select('*').eq('event_id', eventId).order('created_at', { ascending: true });
        if (error) toast.error('Impossible de charger les défis.');
        else setChallenges((data as Challenge[]) ?? []);
    }, [eventId]);

    useEffect(() => {
        // load() ne met l'état à jour qu'après la requête (asynchrone).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load();
    }, [load]);

    async function add(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        const { error } = await supabase.from('challenges').insert({ event_id: eventId, title: title.trim(), description: description.trim() || null, is_active: false });
        setSaving(false);
        if (error) { toast.error(friendlyDbError(error.message)); return; }
        setTitle('');
        setDescription('');
        toast.success('Défi ajouté');
        load();
    }

    async function toggle(c: Challenge) {
        // Un seul défi actif à la fois (garanti aussi par un index unique en base).
        if (!c.is_active) await supabase.from('challenges').update({ is_active: false }).eq('event_id', eventId).eq('is_active', true);
        const { error } = await supabase.from('challenges').update({ is_active: !c.is_active }).eq('id', c.id);
        if (error) toast.error(friendlyDbError(error.message));
        else toast.success(c.is_active ? 'Défi arrêté' : 'Défi lancé : vos invités le voient maintenant');
        load();
    }

    async function remove(c: Challenge) {
        if (!(await confirm({ title: 'Supprimer ce défi ?', message: `« ${c.title} »`, confirmLabel: 'Supprimer', danger: true }))) return;
        const { error } = await supabase.from('challenges').delete().eq('id', c.id);
        if (error) toast.error(friendlyDbError(error.message));
        load();
    }

    return (
        <div className="admin-narrow">
            {dialog}
            <form onSubmit={add} className="admin-panel">
                <h3>Nouveau défi</h3>
                <input className="admin-input" placeholder="Ex : Un selfie avec les mariés" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required />
                <input className="admin-input" placeholder="Précision (facultatif)" value={description} onChange={e => setDescription(e.target.value)} maxLength={280} />
                <div className="chip-row">
                    <span className="admin-hint">Idées :</span>
                    {IDEAS.map(idea => (
                        <button key={idea} type="button" className="chip" onClick={() => setTitle(idea)}>{idea}</button>
                    ))}
                </div>
                <div><button type="submit" className="btn-sage-primary sm" disabled={saving}>Ajouter le défi</button></div>
            </form>

            <h3 className="admin-section-title">Vos défis</h3>
            {challenges.length === 0 ? (
                <div className="empty-state compact"><Zap size={32} /><p>Aucun défi pour le moment. Lancez-en un pendant le cocktail !</p></div>
            ) : (
                <div className="challenge-rows">
                    {challenges.map(c => (
                        <div key={c.id} className={`admin-panel challenge-row${c.is_active ? ' active' : ''}`}>
                            <div>
                                <h4>{c.title}</h4>
                                {c.description && <p>{c.description}</p>}
                            </div>
                            <div className="challenge-row-actions">
                                <button type="button" className={c.is_active ? 'btn-gold-solid' : 'btn-ghost'} onClick={() => toggle(c)}>
                                    {c.is_active ? 'En cours · arrêter' : 'Lancer'}
                                </button>
                                <button type="button" className="icon-button" aria-label="Supprimer le défi" onClick={() => remove(c)}><Trash2 size={18} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
