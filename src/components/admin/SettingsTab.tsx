'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { friendlyDbError } from '@/lib/events';
import { PLANS, canUpgrade, formatPrice, upgradePriceCents, type PaidPlan } from '@/lib/plans';
import { startCheckout } from '@/lib/checkout';
import { authedPost } from '@/lib/api';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { Event } from '@/types';

const PAID_PLANS: PaidPlan[] = ['essential', 'premium'];

// Réglages de l'événement : prénoms, modération, pack (paiement) et suppression.
export default function SettingsTab({ event, paymentInProgress, onSaved }: {
    event: Event;
    paymentInProgress: boolean; // un paiement attend d'être appliqué : pas de nouveau paiement
    onSaved: () => void;
}) {
    const router = useRouter();
    const [confirm, dialog] = useConfirm();
    const [form, setForm] = useState({
        bride_name: event.bride_name ?? '',
        groom_name: event.groom_name ?? '',
        moderation_enabled: event.moderation_enabled,
    });
    const [saving, setSaving] = useState(false);
    const [immediateExecution, setImmediateExecution] = useState(false);
    const [upgradingTo, setUpgradingTo] = useState<PaidPlan | null>(null);
    const [deleting, setDeleting] = useState(false);

    const plan = PLANS[event.plan_type];
    const dirty = form.bride_name !== (event.bride_name ?? '') || form.groom_name !== (event.groom_name ?? '')
        || form.moderation_enabled !== event.moderation_enabled;
    const upgrades = PAID_PLANS.filter(p => canUpgrade(event.plan_type, p));

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        const { error } = await supabase.from('events').update(form).eq('id', event.id);
        setSaving(false);
        if (error) { toast.error(friendlyDbError(error.message)); return; }
        toast.success('Modifications enregistrées');
        onSaved();
    }

    async function upgrade(planType: PaidPlan) {
        setUpgradingTo(planType);
        try {
            await startCheckout(event.id, planType, immediateExecution);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Impossible de lancer le paiement.');
            setUpgradingTo(null);
        }
    }

    async function deleteEvent() {
        const ok = await confirm({
            title: 'Supprimer cet événement ?',
            message: <>« {event.name} » et <strong>toutes ses photos</strong> seront supprimés immédiatement et définitivement. Pensez à télécharger les photos avant.</>,
            confirmLabel: 'Supprimer définitivement',
            danger: true,
            requireText: 'SUPPRIMER',
        });
        if (!ok) return;
        setDeleting(true);
        try {
            await authedPost('/api/events/delete', { eventId: event.id });
            toast.success('Événement supprimé');
            router.push('/dashboard');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'La suppression a échoué.');
            setDeleting(false);
        }
    }

    return (
        <div className="admin-narrow">
            {dialog}
            <form onSubmit={save} className="admin-stack">
                <div className="admin-panel">
                    <h3>Les mariés</h3>
                    <p className="admin-hint">Affichés en titre sur la page des invités, la galerie et le Mur Live.</p>
                    <div className="two-cols">
                        <input className="admin-input" placeholder="Prénom 1" aria-label="Prénom 1" value={form.bride_name}
                            onChange={e => setForm({ ...form, bride_name: e.target.value })} maxLength={80} />
                        <input className="admin-input" placeholder="Prénom 2" aria-label="Prénom 2" value={form.groom_name}
                            onChange={e => setForm({ ...form, groom_name: e.target.value })} maxLength={80} />
                    </div>
                </div>

                <div className="admin-panel setting-row">
                    <div>
                        <h3>Modération des photos</h3>
                        <p className="admin-hint">
                            {plan.moderation
                                ? 'Activée : chaque photo doit être validée par vous avant d’être visible.'
                                : 'Validez chaque photo avant qu’elle apparaisse : inclus dans le pack Premium.'}
                        </p>
                    </div>
                    {plan.moderation && (
                        <label className="switch">
                            <input type="checkbox" checked={form.moderation_enabled}
                                onChange={e => setForm({ ...form, moderation_enabled: e.target.checked })} />
                            <span aria-hidden="true" />
                            <span className="sr-only">Activer la modération</span>
                        </label>
                    )}
                </div>

                <div className="save-bar">
                    <button type="submit" className="btn-sage-primary sm" disabled={!dirty || saving}>
                        {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                </div>
            </form>

            <div className="admin-panel">
                <h3>Votre pack : {plan.label}{event.plan_type === 'discovery' ? ' (gratuit)' : ''}</h3>
                {event.expires_at && (
                    <p className="admin-hint">Galerie ouverte jusqu&apos;au {new Date(event.expires_at).toLocaleDateString('fr-FR')}.</p>
                )}
                {paymentInProgress && <p className="admin-hint">Un paiement est en cours d&apos;activation.</p>}
                {!paymentInProgress && upgrades.length > 0 && (
                    <>
                        <div className="upgrade-grid">
                            {upgrades.map(p => (
                                <div key={p} className={`upgrade-card${p === 'premium' ? ' featured' : ''}`}>
                                    <strong>{PLANS[p].label}</strong>
                                    <span className="upgrade-price">{formatPrice(upgradePriceCents(event.plan_type, p))}</span>
                                    <ul>
                                        <li>Photos illimitées, galerie 1 an</li>
                                        <li>Téléchargement ZIP en HD</li>
                                        {PLANS[p].liveWall && <li>Mur Live, diaporama, défis</li>}
                                        {PLANS[p].moderation && <li>Modération des photos</li>}
                                    </ul>
                                    <button type="button" className="btn-sage-primary sm" onClick={() => upgrade(p)}
                                        disabled={upgradingTo !== null || !immediateExecution}>
                                        {upgradingTo === p ? 'Redirection…' : `Passer en ${PLANS[p].label}`}
                                    </button>
                                </div>
                            ))}
                        </div>
                        <label className="consent">
                            <input type="checkbox" checked={immediateExecution} onChange={e => setImmediateExecution(e.target.checked)} />
                            <span>
                                Je demande l&apos;accès immédiat au service. Je pourrai me rétracter et être remboursé jusqu&apos;à la date de
                                mon événement ; ensuite, je ne pourrai plus exercer mon droit de rétractation (<a href="/cgv" target="_blank" rel="noopener noreferrer">CGV</a>).
                            </span>
                        </label>
                    </>
                )}
            </div>

            <div className="admin-panel danger-zone">
                <h3>Supprimer cet événement</h3>
                <p className="admin-hint">Toutes les photos sont supprimées immédiatement et définitivement. Les factures sont conservées.</p>
                <button type="button" className="btn-danger-outline" onClick={deleteEvent} disabled={deleting}>
                    {deleting ? 'Suppression…' : 'Supprimer définitivement'}
                </button>
            </div>
        </div>
    );
}
