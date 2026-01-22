'use client';

import Link from 'next/link';
import { Check, X, Star, Zap, Crown } from 'lucide-react';

export default function PricingPage() {
    return (
        <main className="pricing-container">
            {/* Background */}
            <div className="pricing-bg">
                <img
                    src="https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop"
                    alt="Wedding Background"
                />
                <div className="pricing-overlay" />
            </div>

            <div className="pricing-content">
                <header style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <h1 className="pricing-title">Choisissez votre Expérience</h1>
                    <p className="pricing-subtitle">Pas d'abonnement. Un seul paiement pour votre grand jour.</p>
                </header>

                <div className="pricing-grid">
                    {/* PACK DÉCOUVERTE */}
                    <div className="pricing-card">
                        <div className="pricing-header">
                            <h3>DÉCOUVERTE</h3>
                            <div className="price">0€</div>
                            <p className="description">Pour tester avec vos témoins</p>
                        </div>
                        <ul className="features-list">
                            <li><Check size={16} /> 10 Invités max</li>
                            <li><Check size={16} /> 50 Photos</li>
                            <li><Check size={16} /> Galerie disponible 48h</li>
                            <li className="disabled"><X size={16} /> Basse Résolution</li>
                            <li className="disabled"><X size={16} /> Pas de Live Wall</li>
                            <li className="disabled"><X size={16} /> Pas de Défis</li>
                        </ul>
                        <button className="btn-pricing outline">Essayer gratuitement</button>
                    </div>

                    {/* PACK ESSENTIEL (POPULAR) */}
                    <div className="pricing-card popular">
                        <div className="popular-badge"><Star size={12} fill="white" /> LE PLUS POPULAIRE</div>
                        <div className="pricing-header">
                            <h3>ESSENTIEL</h3>
                            <div className="price">159€</div>
                            <p className="description">Pour capturer chaque instant</p>
                        </div>
                        <ul className="features-list">
                            <li><Check size={16} color="var(--gold-primary)" /> <strong>Invités Illimités</strong></li>
                            <li><Check size={16} color="var(--gold-primary)" /> <strong>Photos Illimitées</strong></li>
                            <li><Check size={16} color="var(--gold-primary)" /> Galerie active 1 an</li>
                            <li><Check size={16} color="var(--gold-primary)" /> Téléchargement HD</li>
                            <li><Check size={16} color="var(--gold-primary)" /> QR Code Personnalisable</li>
                            <li className="disabled"><X size={16} /> Pas de Live Wall</li>
                            <li className="disabled"><X size={16} /> Pas de Défis</li>
                        </ul>
                        <button className="btn-pricing gold">Choisir ce pack</button>
                    </div>

                    {/* PACK PREMIUM */}
                    <div className="pricing-card premium">
                        <div className="pricing-header">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                <h3>PREMIUM</h3>
                                <Crown size={20} color="var(--gold-primary)" />
                            </div>
                            <div className="price">199€</div>
                            <p className="description">L'expérience mariage complète</p>
                        </div>
                        <ul className="features-list">
                            <li><Check size={16} color="var(--gold-primary)" /> <strong>Tout l'Essentiel +</strong></li>
                            <li><Check size={16} color="var(--gold-primary)" /> <strong style={{ color: 'var(--gold-primary)' }}>LIVE WALL (Diaporama)</strong></li>
                            <li><Check size={16} color="var(--gold-primary)" /> <strong style={{ color: 'var(--gold-primary)' }}>DÉFIS PHOTOS (Gamification)</strong></li>
                            <li><Check size={16} color="var(--gold-primary)" /> Modération en direct</li>
                            <li><Check size={16} color="var(--gold-primary)" /> Support Prioritaire 7j/7</li>
                        </ul>
                        <button className="btn-pricing outline">Devenir Premium</button>
                    </div>
                </div>

                <div className="pricing-footer">
                    <p>Paiement 100% sécurisé via Stripe • Satisfait ou Remboursé</p>
                    <Link href="/" style={{ color: 'white', textDecoration: 'underline', marginTop: '20px', display: 'block' }}>Retour à l'accueil</Link>
                </div>
            </div>
        </main>
    );
}
