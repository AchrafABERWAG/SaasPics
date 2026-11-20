'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { friendlyDbError } from '@/lib/events';
import { startCheckout } from '@/lib/checkout';
import { PLANS, formatPrice, isPaidPlan } from '@/lib/plans';
import { getReferralCode } from '@/lib/referral';
import { LEGAL } from '@/lib/legal';
import { useSession } from '@/hooks/useSession';
import { Loader2, Heart, ArrowRight, MailCheck } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';
import toast from 'react-hot-toast';

import { Suspense } from 'react';

// Brouillon conservé pendant la confirmation de l'email (jamais le mot de passe).
const DRAFT_KEY = 'create_event_draft';
type Draft = { brideName: string; groomName: string; date: string; plan: string | null };

function saveDraft(draft: Draft) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* stockage indisponible */ }
}
function loadDraft(): Draft | null {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; }
}
function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* stockage indisponible */ }
}

// Ne bloque jamais la création : un email manqué n'empêche pas d'accéder à son espace.
async function sendWelcomeEmail(eventId: string) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await fetch('/api/emails/welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ eventId }),
        });
    } catch (err) {
        console.error('Welcome email error:', err);
    }
}

// Le slug sert aussi de "clé" d'accès à la galerie invités : partie aléatoire longue.
function generateSlug(bride: string, groom: string, date: string) {
    const cleanName = `${bride}-${groom}`
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50) || 'evenement';
    const year = new Date(date).getFullYear();
    const random = uuidv4().replace(/-/g, '').slice(0, 10);
    return `${cleanName}-${year}-${random}`;
}

const consentStyle: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', fontSize: '0.8rem', color: '#ccc', lineHeight: 1.5, cursor: 'pointer' };
const linkStyle: React.CSSProperties = { color: 'var(--gold-primary)', textDecoration: 'underline' };

function CreateEventContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { session, loading: sessionLoading } = useSession();
    const [requestedPlan, setRequestedPlan] = useState<string | null>(searchParams.get('plan'));
    const [loading, setLoading] = useState(false);
    const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [immediateExecution, setImmediateExecution] = useState(false);
    const [formData, setFormData] = useState({
        brideName: '',
        groomName: '',
        date: '',
        userEmail: '',
        password: ''
    });

    const today = new Date().toISOString().slice(0, 10);
    const needsAccount = !session;
    const isFormValid = formData.brideName && formData.groomName && formData.date
        && (!needsAccount || (formData.userEmail && formData.password.length >= 6))
        && acceptTerms && (!isPaidPlan(requestedPlan) || immediateExecution);

    // Retour après confirmation de l'email : on recharge le brouillon.
    useEffect(() => {
        const draft = loadDraft();
        if (!draft) return;
        // Brouillon stocké dans le navigateur : lisible seulement après le montage.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormData(f => ({ ...f, brideName: draft.brideName, groomName: draft.groomName, date: draft.date }));
        if (!searchParams.get('plan') && draft.plan) setRequestedPlan(draft.plan);
    }, [searchParams]);

    // Renvoie l'id de l'utilisateur connecté, ou null si l'email doit d'abord être confirmé.
    async function ensureUser(): Promise<string | null> {
        if (session) return session.user.id;

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.userEmail,
            password: formData.password,
            options: { emailRedirectTo: `${window.location.origin}/create` },
        });

        if (authError) {
            if (/already registered|already exists/i.test(authError.message)) {
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                    email: formData.userEmail,
                    password: formData.password
                });
                if (signInError) {
                    throw new Error(/not confirmed/i.test(signInError.message)
                        ? "Confirmez d'abord votre adresse email (lien reçu par email)."
                        : "Cet email est déjà utilisé. S'il s'agit de votre compte, le mot de passe est incorrect.");
                }
                return signInData.user?.id ?? null;
            }
            throw authError;
        }

        if (!authData.session) {
            // Confirmation d'email activée : on garde le brouillon et on attend le clic sur le lien.
            saveDraft({ brideName: formData.brideName, groomName: formData.groomName, date: formData.date, plan: requestedPlan });
            setAwaitingConfirmation(formData.userEmail);
            return null;
        }
        return authData.user?.id ?? null;
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const slug = generateSlug(formData.brideName, formData.groomName, formData.date);
        const eventName = `${formData.brideName} & ${formData.groomName}`;

        try {
            const userId = await ensureUser();
            if (!userId) return;

            // Le pack (toujours "discovery" à la création), le propriétaire et le partenaire
            // sont fixés par la base. Le passage à un pack payant se fait après paiement.
            const eventId = uuidv4();
            const { error } = await supabase
                .from('events')
                .insert([
                    {
                        id: eventId,
                        name: eventName,
                        slug: slug,
                        date: formData.date,
                        bride_name: formData.brideName,
                        groom_name: formData.groomName,
                        moderation_enabled: false,
                        admin_id: userId,
                        ref_code: searchParams.get('ref') || getReferralCode(),
                        terms_version: LEGAL.termsVersion
                    }
                ])
                .select()
                .single();

            if (error) throw error;
            clearDraft();

            // Pack payant choisi sur la page de tarifs : on enchaîne sur le paiement
            // (l'email de confirmation de paiement fera office de bienvenue).
            if (isPaidPlan(requestedPlan)) {
                try {
                    await startCheckout(eventId, requestedPlan, immediateExecution);
                    return; // redirection vers Stripe en cours
                } catch (checkoutErr) {
                    console.error('Checkout error:', checkoutErr);
                    toast.error("Votre événement est créé, mais le paiement n'a pas pu démarrer. Relancez-le depuis la configuration de l'événement.", { duration: 8000 });
                }
            }

            await sendWelcomeEmail(eventId);
            router.push(`/admin/${slug}`);

        } catch (err) {
            console.error('Creation Error:', err);
            const message = err instanceof Error ? err.message : (err as { message?: string })?.message;
            toast.error('Erreur lors de la création : ' + friendlyDbError(message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-bg">
                <img src="/images/couple.jpg" alt="" />
            </div>
            <div className="login-overlay"></div>

            <div className="login-card" style={{ maxWidth: 500 }}>
                <Link href={session ? '/dashboard' : '/'} style={{ position: 'absolute', top: 20, left: 20, color: 'white', textDecoration: 'none', fontSize: '0.9rem', opacity: 0.7 }}>
                    &larr; Retour
                </Link>

                {awaitingConfirmation ? (
                    <div style={{ color: 'white', padding: '20px 0' }}>
                        <MailCheck size={44} style={{ color: 'var(--gold-primary)', margin: '0 auto 15px auto' }} />
                        <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2rem', marginBottom: 12 }}>Confirmez votre email</h1>
                        <p style={{ color: '#ccc', lineHeight: 1.6 }}>
                            Nous avons envoyé un lien à <strong>{awaitingConfirmation}</strong>.<br />
                            Cliquez dessus : vous reviendrez ici pour finaliser votre événement, déjà prérempli.
                        </p>
                    </div>
                ) : (
                <>
                <div style={{ marginBottom: 30 }}>
                    <Heart size={40} style={{ color: 'var(--gold-primary)', margin: '0 auto 15px auto' }} />
                    <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2.5rem', color: 'white', marginBottom: 10 }}>Créer votre événement</h1>
                    <p style={{ color: '#ccc', letterSpacing: 2, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        {isPaidPlan(requestedPlan)
                            ? `Pack ${PLANS[requestedPlan].label} — ${formatPrice(PLANS[requestedPlan].priceCents)}`
                            : 'Commencez gratuitement'}
                    </p>
                </div>

                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <input
                            type="text"
                            placeholder="Prénom 1 (ex: Léa)"
                            className="login-input"
                            style={{ margin: 0 }}
                            value={formData.brideName}
                            onChange={e => setFormData({ ...formData, brideName: e.target.value })}
                            maxLength={60}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Prénom 2 (ex: Thomas)"
                            className="login-input"
                            style={{ margin: 0 }}
                            value={formData.groomName}
                            onChange={e => setFormData({ ...formData, groomName: e.target.value })}
                            maxLength={60}
                            required
                        />
                    </div>

                    <input
                        type="date"
                        className="login-input"
                        style={{ margin: 0 }}
                        value={formData.date}
                        min={today}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        required
                    />

                    {sessionLoading ? null : needsAccount ? (
                        <>
                            <input
                                type="email"
                                placeholder="votre@email.com"
                                className="login-input"
                                style={{ margin: 0 }}
                                value={formData.userEmail}
                                onChange={e => setFormData({...formData, userEmail: e.target.value})}
                                autoComplete="email"
                                required
                            />

                            <input
                                type="password"
                                placeholder="Mot de passe (6 caractères min)"
                                className="login-input"
                                style={{ margin: 0 }}
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                                autoComplete="new-password"
                                required
                                minLength={6}
                            />
                            <p style={{ fontSize: '0.8rem', color: '#aaa', margin: 0 }}>
                                Déjà un compte ? Saisissez vos identifiants habituels, ou <Link href="/dashboard" style={{ color: 'var(--gold-primary)' }}>connectez-vous</Link>.
                            </p>
                        </>
                    ) : (
                        <p style={{ fontSize: '0.85rem', color: '#ccc', margin: 0 }}>
                            Connecté en tant que <strong>{session?.user.email}</strong>
                        </p>
                    )}

                    <label style={consentStyle}>
                        <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} required style={{ marginTop: 3 }} />
                        <span>
                            J&apos;accepte les <a href="/cgv" target="_blank" rel="noopener noreferrer" style={linkStyle}>conditions générales</a> et
                            la <a href="/confidentialite" target="_blank" rel="noopener noreferrer" style={linkStyle}>politique de confidentialité</a>.
                        </span>
                    </label>
                    {isPaidPlan(requestedPlan) && (
                        <label style={consentStyle}>
                            <input type="checkbox" checked={immediateExecution} onChange={e => setImmediateExecution(e.target.checked)} required style={{ marginTop: 3 }} />
                            <span>
                                Je demande l&apos;accès immédiat au service. Je pourrai me rétracter et être remboursé jusqu&apos;à la date de
                                mon événement ; ensuite, le service étant pleinement exécuté, je ne pourrai plus exercer mon droit de rétractation.
                            </span>
                        </label>
                    )}

                    <button
                        type="submit"
                        disabled={!isFormValid || loading}
                        className="btn-gold"
                        style={{
                            padding: '16px',
                            borderRadius: '12px',
                            fontSize: '1.1rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '10px',
                            marginTop: '10px',
                            opacity: isFormValid ? 1 : 0.5,
                            cursor: isFormValid ? 'pointer' : 'not-allowed'
                        }}
                    >
                        {loading ? (
                            <><Loader2 className="animate-spin" /> Création...</>
                        ) : (
                            <>C&apos;est parti <ArrowRight size={20} /></>
                        )}
                    </button>
                </form>

                <p style={{ marginTop: '20px', fontSize: '0.75rem', color: '#888' }}>
                    Les photos sont visibles par toute personne disposant du lien de votre événement.<br/>
                    {isPaidPlan(requestedPlan)
                        ? 'Vous serez ensuite redirigé vers le paiement sécurisé (Stripe).'
                        : 'Pas de carte bancaire requise.'}
                </p>
                </>
                )}
            </div>
        </div>
    );
}

export default function CreateEventPage() {
    return (
        <Suspense fallback={<div className="login-container"><div className="login-card">Chargement...</div></div>}>
            <CreateEventContent />
        </Suspense>
    );
}
