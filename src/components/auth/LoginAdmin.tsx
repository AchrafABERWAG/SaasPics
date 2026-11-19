'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Lock } from 'lucide-react';

export default function LoginAdmin({
    onLoginSuccess,
    title = 'Espace Admin',
    subtitle = 'Gérer votre événement',
    footer,
}: {
    onLoginSuccess: () => void;
    title?: string;
    subtitle?: string;
    footer?: React.ReactNode;
}) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetMsg, setResetMsg] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            onLoginSuccess();
        } catch (err) {
            const message = err instanceof Error ? err.message : '';
            setErrorMsg(/not confirmed/i.test(message)
                ? 'Confirmez d’abord votre adresse email (lien reçu par email).'
                : 'Identifiants incorrects.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        setResetMsg('');

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            setResetMsg('Un email de réinitialisation vous a été envoyé.');
        } catch (err) {
            setErrorMsg('Erreur lors de la réinitialisation : ' + (err instanceof Error ? err.message : String(err)));
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
            
            <div className="login-card" style={{ maxWidth: 450 }}>
                <div style={{ marginBottom: 30 }}>
                    <Lock size={40} style={{ color: 'var(--gold-primary)', margin: '0 auto 15px auto' }} />
                    <h1 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '2.5rem', color: 'white', marginBottom: 10 }}>{title}</h1>
                    <p style={{ color: '#ccc', letterSpacing: 2, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        {isForgotPassword ? 'Réinitialiser votre mot de passe' : subtitle}
                    </p>
                </div>

                {errorMsg && (
                    <div style={{ backgroundColor: 'rgba(255, 0, 0, 0.1)', color: '#ff6b6b', padding: '15px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid rgba(255,0,0,0.2)' }}>
                        {errorMsg}
                    </div>
                )}
                {resetMsg && (
                    <div style={{ backgroundColor: 'rgba(0, 255, 0, 0.1)', color: '#4ade80', padding: '15px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid rgba(0,255,0,0.2)' }}>
                        {resetMsg}
                    </div>
                )}

                {!isForgotPassword ? (
                    <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <input 
                            type="email" 
                            placeholder="Email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="login-input"
                            style={{ margin: 0 }}
                        />
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="password" 
                                placeholder="Mot de passe"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="login-input"
                                style={{ margin: 0, width: '100%' }}
                            />
                            <button 
                                type="button" 
                                onClick={() => setIsForgotPassword(true)} 
                                style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--gold-primary)', fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                                Oublié ?
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !email || !password}
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
                                opacity: (loading || !email || !password) ? 0.5 : 1,
                                cursor: (loading || !email || !password) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Se connecter'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <input 
                            type="email" 
                            placeholder="Email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="login-input"
                            style={{ margin: 0 }}
                        />
                        <button
                            type="submit"
                            disabled={loading || !email}
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
                                opacity: (loading || !email) ? 0.5 : 1,
                                cursor: (loading || !email) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : 'Envoyer le lien'}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setIsForgotPassword(false)} 
                            style={{ background: 'none', border: 'none', color: '#888', fontSize: '0.9rem', cursor: 'pointer', marginTop: '10px' }}
                        >
                            Retour à la connexion
                        </button>
                    </form>
                )}
                {footer && <div style={{ marginTop: '20px', fontSize: '0.9rem', color: '#ccc' }}>{footer}</div>}
            </div>
        </div>
    );
}
