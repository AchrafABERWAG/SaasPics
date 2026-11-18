'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { friendlyDbError } from '@/lib/events';
import { startCheckout } from '@/lib/checkout';
import { PLANS, formatPrice, isPaidPlan } from '@/lib/plans';
import { Loader2, Heart, ArrowRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

import { Suspense } from 'react';

function CreateEventContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedPlan = searchParams.get('plan');
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        brideName: '',
        groomName: '',
        date: '',
        userEmail: '',
        password: ''
    });

    const isFormValid = formData.brideName && formData.groomName && formData.date && formData.userEmail && formData.password.length >= 6;

    // Le slug sert aussi de "clé" d'accès à la galerie invités : partie aléatoire longue.
    const generateSlug = (bride: string, groom: string, date: string) => {
        const cleanName = `${bride}-${groom}`
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50) || 'evenement';
        const year = new Date(date).getFullYear();
        const random = uuidv4().replace(/-/g, '').slice(0, 10);
        return `${cleanName}-${year}-${random}`;
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const slug = generateSlug(formData.brideName, formData.groomName, formData.date);
        const eventName = `${formData.brideName} & ${formData.groomName}`;

        try {
            let userId;
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.userEmail,
                password: formData.password
            });

            if (authError) {
                // Si l'utilisateur existe déjà, on essaie de le connecter
                if (authError.message.includes('User already registered') || authError.message.includes('already exists') || authError.status === 400) {
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                        email: formData.userEmail,
                        password: formData.password
                    });
                    
                    if (signInError) {
                        throw new Error("Cet email est déjà utilisé. S'il s'agit de votre compte, le mot de passe est incorrect.");
                    }
                    userId = signInData.user?.id;
                } else {
                    throw authError;
                }
            } else {
                userId = authData.user?.id;
            }
            
            if (!userId) {
                throw new Error("Impossible de récupérer l'identifiant utilisateur.");
            }

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
                        ref_code: searchParams.get('ref') || null
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            // Pack payant choisi sur la page de tarifs : on enchaîne sur le paiement.
            if (isPaidPlan(requestedPlan)) {
                try {
                    await startCheckout(eventId, requestedPlan);
                    return; // redirection vers Stripe en cours
                } catch (checkoutErr) {
                    console.error('Checkout error:', checkoutErr);
                    alert("Votre événement est créé, mais le paiement n'a pas pu démarrer. Vous pourrez le relancer depuis votre espace.");
                }
            }

            router.push(`/admin/${slug}`);

        } catch (err) {
            console.error('Creation Error:', err);
            const message = err instanceof Error ? err.message : (err as { message?: string })?.message;
            alert('Erreur lors de la création : ' + friendlyDbError(message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-bg">
                <img src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069&auto=format&fit=crop" alt="Wedding Background" />
            </div>
            <div className="login-overlay"></div>
            
            <div className="login-card" style={{ maxWidth: 500 }}>
                <Link href="/" style={{ position: 'absolute', top: 20, left: 20, color: 'white', textDecoration: 'none', fontSize: '0.9rem', opacity: 0.7 }}>
                    &larr; Retour
                </Link>
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
                            required
                        />
                        <input
                            type="text"
                            placeholder="Prénom 2 (ex: Thomas)"
                            className="login-input"
                            style={{ margin: 0 }}
                            value={formData.groomName}
                            onChange={e => setFormData({ ...formData, groomName: e.target.value })}
                            required
                        />
                    </div>

                    <input
                        type="date"
                        className="login-input"
                        style={{ margin: 0 }}
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        required
                    />

                    <input 
                        type="email" 
                        placeholder="votre@email.com"
                        className="login-input"
                        style={{ margin: 0 }}
                        value={formData.userEmail}
                        onChange={e => setFormData({...formData, userEmail: e.target.value})}
                        required
                    />

                    <input 
                        type="password" 
                        placeholder="Mot de passe admin (6 caractères min)"
                        className="login-input"
                        style={{ margin: 0 }}
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        required
                        minLength={6}
                    />

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
                    En cliquant, vous acceptez de créer un espace public pour votre événement.<br/>
                    {isPaidPlan(requestedPlan)
                        ? 'Vous serez ensuite redirigé vers le paiement sécurisé (Stripe).'
                        : 'Pas de carte bancaire requise.'}
                </p>
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
