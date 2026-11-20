'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Lock, Building, User, Globe, Loader2, MailCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { BRAND } from '@/lib/brand';
import { ACTIVITIES, savePartnerDraft, submitPartnerApplication, type PartnerApplication } from '@/lib/partners';

export default function ProSignupPage() {
    const router = useRouter();
    const { session, loading: sessionLoading } = useSession();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);
    const [form, setForm] = useState({
        first_name: '', last_name: '', company: '', activity: 'photographer' as PartnerApplication['activity'],
        website: '', weddings_per_year: '1-10' as NonNullable<PartnerApplication['weddings_per_year']>,
        email: '', password: '',
    });

    const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value }));

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        const application: PartnerApplication = {
            first_name: form.first_name.trim(), last_name: form.last_name.trim(),
            company: form.company.trim() || null, activity: form.activity,
            website: form.website.trim() || null, weddings_per_year: form.weddings_per_year,
        };

        try {
            if (!session) {
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email: form.email,
                    password: form.password,
                    options: { emailRedirectTo: `${window.location.origin}/pro/dashboard` },
                });
                if (signUpError) {
                    if (/already registered|already exists/i.test(signUpError.message)) {
                        const { error: signInError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
                        if (signInError) throw new Error("Cet email a déjà un compte. Vérifiez votre mot de passe, ou connectez-vous d'abord.");
                    } else {
                        throw signUpError;
                    }
                } else if (!data.session) {
                    // Confirmation d'email : la candidature sera envoyée au retour sur le tableau de bord.
                    savePartnerDraft(application);
                    setAwaitingConfirmation(form.email);
                    return;
                }
            }

            await submitPartnerApplication(application);
            router.push('/pro/dashboard');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="romance-wrapper">
            <nav className="romance-nav scrolled solid-nav">
                <div className="nav-container">
                    <Link href="/pro" className="nav-back-link">
                        <ArrowLeft size={20} /> Retour Espace Pro
                    </Link>
                    <div className="nav-logo">
                        <span className="logo-text">{BRAND.proName}</span>
                    </div>
                    <div style={{ width: 100 }}></div>
                </div>
            </nav>

            <div className="auth-container">
                <div className="auth-card">
                    {awaitingConfirmation ? (
                        <header className="auth-header">
                            <MailCheck size={40} style={{ color: '#A3B19C', margin: '0 auto 12px auto' }} />
                            <h1>Confirmez votre email</h1>
                            <p>Nous avons envoyé un lien à <strong>{awaitingConfirmation}</strong>. Cliquez dessus pour finaliser votre candidature.</p>
                        </header>
                    ) : (
                    <>
                    <header className="auth-header">
                        <h1>Devenir Partenaire</h1>
                        <p>Rejoignez le réseau {BRAND.name} et touchez une commission sur chaque pack vendu à vos clients.</p>
                    </header>

                    {error && (
                        <div role="alert" style={{ background: '#FDECEC', color: '#B42318', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: '0.9rem' }}>
                            {error}
                        </div>
                    )}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="form-group half">
                            <label htmlFor="first_name">Prénom</label>
                            <div className="input-wrapper">
                                <User size={18} />
                                <input id="first_name" type="text" placeholder="Sophie" value={form.first_name} onChange={set('first_name')} maxLength={80} required />
                            </div>
                        </div>
                        <div className="form-group half">
                            <label htmlFor="last_name">Nom</label>
                            <div className="input-wrapper">
                                <User size={18} />
                                <input id="last_name" type="text" placeholder="Martin" value={form.last_name} onChange={set('last_name')} maxLength={80} required />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="company">Nom de l&apos;entreprise</label>
                            <div className="input-wrapper">
                                <Building size={18} />
                                <input id="company" type="text" placeholder="Sophie Wedding Planner" value={form.company} onChange={set('company')} maxLength={120} />
                            </div>
                        </div>

                        <div className="form-group half">
                            <label htmlFor="activity">Activité principale</label>
                            <select id="activity" className="auth-select" value={form.activity} onChange={set('activity')}>
                                {ACTIVITIES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                            </select>
                        </div>
                        <div className="form-group half">
                            <label htmlFor="weddings">Mariages par an</label>
                            <select id="weddings" className="auth-select" value={form.weddings_per_year} onChange={set('weddings_per_year')}>
                                <option value="1-10">1 à 10</option>
                                <option value="10-30">10 à 30</option>
                                <option value="30+">Plus de 30</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="website">Site web ou Instagram</label>
                            <div className="input-wrapper">
                                <Globe size={18} />
                                <input id="website" type="text" placeholder="www.mon-site.com" value={form.website} onChange={set('website')} maxLength={255} />
                            </div>
                        </div>

                        {sessionLoading ? null : session ? (
                            <p style={{ fontSize: '0.9rem', color: '#666' }}>Candidature au nom de <strong>{session.user.email}</strong></p>
                        ) : (
                            <>
                                <div className="form-group">
                                    <label htmlFor="email">Email professionnel</label>
                                    <div className="input-wrapper">
                                        <Mail size={18} />
                                        <input id="email" type="email" placeholder="contact@sophie.com" value={form.email} onChange={set('email')} autoComplete="email" required />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="password">Mot de passe</label>
                                    <div className="input-wrapper">
                                        <Lock size={18} />
                                        <input id="password" type="password" placeholder="6 caractères minimum" value={form.password} onChange={set('password')} minLength={6} autoComplete="new-password" required />
                                    </div>
                                </div>
                            </>
                        )}

                        <button type="submit" className="btn-sage-primary full-width" disabled={submitting} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                            {submitting && <Loader2 size={18} className="animate-spin" />}
                            Envoyer ma candidature
                        </button>

                        <div className="auth-footer">
                            <p>Déjà partenaire ? <Link href="/pro/login">Se connecter</Link></p>
                        </div>
                    </form>
                    </>
                    )}
                </div>
            </div>
        </div>
    );
}
