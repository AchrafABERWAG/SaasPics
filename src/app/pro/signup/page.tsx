'use client';

import Link from 'next/link';
import { ArrowLeft, Mail, Lock, Building, User } from 'lucide-react';

export default function ProSignupPage() {
    return (
        <div className="romance-wrapper">
            <nav className="romance-nav">
                <div className="nav-container">
                    <Link href="/pro" className="nav-back-link">
                        <ArrowLeft size={20} /> Retour Espace Pro
                    </Link>
                    <div className="nav-logo">
                        <span className="logo-text">Lumina Pro</span>
                    </div>
                    <div style={{ width: 100 }}></div>
                </div>
            </nav>

            <div className="auth-container">
                <div className="auth-card">
                    <header className="auth-header">
                        <h1>Devenir Partenaire</h1>
                        <p>Rejoignez le réseau Lumina et boostez votre activité.</p>
                    </header>

                    <form className="auth-form">
                        <div className="form-group half">
                            <label>Prénom</label>
                            <div className="input-wrapper">
                                <User size={18} />
                                <input type="text" placeholder="Sophie" />
                            </div>
                        </div>
                        <div className="form-group half">
                            <label>Nom</label>
                            <div className="input-wrapper">
                                <User size={18} />
                                <input type="text" placeholder="Martin" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Nom de l'Entreprise</label>
                            <div className="input-wrapper">
                                <Building size={18} />
                                <input type="text" placeholder="Sophie Wedding Planner" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Email Professionnel</label>
                            <div className="input-wrapper">
                                <Mail size={18} />
                                <input type="email" placeholder="contact@sophie.com" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Mot de passe</label>
                            <div className="input-wrapper">
                                <Lock size={18} />
                                <input type="password" placeholder="••••••••" />
                            </div>
                        </div>

                        <button type="submit" className="btn-sage-primary full-width">
                            Créer mon compte
                        </button>

                        <div className="auth-footer">
                            <p>Déjà un compte ? <Link href="/pro/login">Se connecter</Link></p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
