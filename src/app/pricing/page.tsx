'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X, Star, Heart, Crown, ArrowLeft, Loader2 } from 'lucide-react';

export default function PricingPage() {
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

    const handleCheckout = async (planType: string) => {
        try {
            setLoadingPlan(planType);
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planType }),
            });
            const data = await res.json();
            
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(data.error || 'Erreur lors de la redirection vers le paiement.');
                setLoadingPlan(null);
            }
        } catch (error) {
            console.error(error);
            alert('Une erreur est survenue.');
            setLoadingPlan(null);
        }
    };

    return (
        <div className="romance-wrapper">

            {/* Navbar Minimal */}
            <nav className="romance-nav">
                <div className="nav-container">
                    <Link href="/" className="nav-back-link">
                        <ArrowLeft size={20} /> Retour à l'accueil
                    </Link>
                    <div className="nav-logo">
                        <span className="logo-text">Lumina</span>
                    </div>
                    <div style={{ width: 100 }}></div> {/* Spacer for visual balance */}
                </div>
            </nav>

            <div className="pricing-page-container">

                {/* Header */}
                <header className="pricing-hero">
                    <h1 className="hero-title">Investissez dans vos <span className="serif-highlight">Souvenirs.</span></h1>
                    <p className="hero-subtitle">Des formules simples et transparentes pour capturer chaque instant de votre mariage.</p>
                </header>

                {/* Pricing Grid */}
                <div className="romance-pricing-grid">

                    {/* DÉCOUVERTE */}
                    <div className="price-card basic">
                        <div className="card-header">
                            <h3>Découverte</h3>
                            <div className="price">Gratuit</div>
                            <p className="desc">Pour les mariages intimes ou pour tester l'expérience.</p>
                        </div>
                        <ul className="features-list">
                            <li><Check size={18} className="icon-sage" /> 10 Invités maximum</li>
                            <li><Check size={18} className="icon-sage" /> 50 Photos</li>
                            <li><Check size={18} className="icon-sage" /> Galerie en ligne 48h</li>
                            <li className="disabled"><X size={18} /> Pas de Live Wall</li>
                            <li className="disabled"><X size={18} /> Pas de téléchargement HD</li>
                        </ul>
                        <Link href="/create?plan=free" className="btn-sage-outline full-width">
                            Commencer
                        </Link>
                    </div>

                    {/* ESSENTIEL */}
                    <div className="price-card popular">
                        <div className="popular-badge"><Heart size={14} fill="white" /> Choix des Mariés</div>
                        <div className="card-header">
                            <h3>Essentiel</h3>
                            <div className="price">59€</div>
                            <p className="desc">La formule idéale pour collecter tous les souvenirs.</p>
                        </div>
                        <ul className="features-list">
                            <li><Check size={18} className="icon-rose" /> <strong>Invités Illimités</strong></li>
                            <li><Check size={18} className="icon-rose" /> <strong>Photos & Vidéos Illimitées</strong></li>
                            <li><Check size={18} className="icon-rose" /> Galerie disponible 1 an</li>
                            <li><Check size={18} className="icon-rose" /> Téléchargement ZIP HD</li>
                            <li><Check size={18} className="icon-rose" /> QR Code Personnalisé</li>
                            <li className="disabled"><X size={18} /> Pas de Live Wall</li>
                        </ul>
                        <button 
                            onClick={() => handleCheckout('essential')} 
                            disabled={loadingPlan !== null}
                            className="btn-rose-primary full-width"
                            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                        >
                            {loadingPlan === 'essential' ? <Loader2 size={18} className="animate-spin" /> : null}
                            Choisir ce pack
                        </button>
                    </div>

                    {/* PREMIUM */}
                    <div className="price-card premium">
                        <div className="card-header">
                            <div className="premium-title">
                                <h3>Premium</h3>
                                <Crown size={18} className="icon-gold" />
                            </div>
                            <div className="price">99€</div>
                            <p className="desc">L'expérience complète avec animation sur écran géant.</p>
                        </div>
                        <ul className="features-list">
                            <li><Check size={18} className="icon-gold" /> Tout le pack Essentiel</li>
                            <li><Check size={18} className="icon-gold" /> <strong>Live Wall (Diaporama TV)</strong></li>
                            <li><Check size={18} className="icon-gold" /> <strong>Défis Photos (Jeu)</strong></li>
                            <li><Check size={18} className="icon-gold" /> Modération des photos</li>
                            <li><Check size={18} className="icon-gold" /> Support Prioritaire</li>
                        </ul>
                        <button 
                            onClick={() => handleCheckout('premium')} 
                            disabled={loadingPlan !== null}
                            className="btn-sage-primary full-width"
                            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                        >
                            {loadingPlan === 'premium' ? <Loader2 size={18} className="animate-spin" /> : null}
                            L'Expérience Ultime
                        </button>
                    </div>

                </div>

                {/* FAQ Section */}
                <div className="pricing-faq">
                    <h2>Questions Fréquentes</h2>
                    <div className="faq-grid">
                        <div className="faq-item">
                            <h4>Est-ce un abonnement ?</h4>
                            <p>Non, c'est un paiement unique valable pour toute la durée de votre événement et l'année de conservation.</p>
                        </div>
                        <div className="faq-item">
                            <h4>Faut-il installer une application ?</h4>
                            <p>Non ! Vos invités scannent simplement un QR Code. Rien à télécharger, ça fonctionne instantanément.</p>
                        </div>
                        <div className="faq-item">
                            <h4>Et si je n'ai pas de réseau ?</h4>
                            <p>L'application continue de fonctionner et enverra les photos dès que la connexion sera rétablie.</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
