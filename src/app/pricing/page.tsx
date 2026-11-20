'use client';

import Link from 'next/link';
import { Check, X, Heart, Crown, ArrowLeft } from 'lucide-react';
import { PLANS, formatPrice } from '@/lib/plans';
import SiteFooter from '@/components/SiteFooter';
import { BRAND } from '@/lib/brand';

// Le paiement se fait après la création de l'événement (il faut un événement à rattacher).
export default function PricingPage() {

    return (
        <div className="romance-wrapper">

            {/* Navbar Minimal */}
            <nav className="romance-nav scrolled solid-nav">
                <div className="nav-container">
                    <Link href="/" className="nav-back-link">
                        <ArrowLeft size={20} /> <span className="nav-back-text">Retour à l'accueil</span>
                    </Link>
                    <div className="nav-logo">
                        <span className="logo-text">{BRAND.name}</span>
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
                            <li><Check size={18} className="icon-sage" /> Invités illimités</li>
                            <li><Check size={18} className="icon-sage" /> {PLANS.discovery.maxPhotos} photos</li>
                            <li><Check size={18} className="icon-sage" /> Galerie en ligne {PLANS.discovery.galleryDuration}</li>
                            <li className="disabled"><X size={18} /> Pas de Live Wall</li>
                            <li className="disabled"><X size={18} /> Pas de téléchargement HD</li>
                        </ul>
                        <Link href="/create" className="btn-sage-outline full-width">
                            Commencer
                        </Link>
                    </div>

                    {/* ESSENTIEL */}
                    <div className="price-card popular">
                        <div className="popular-badge"><Heart size={14} fill="white" /> Choix des Mariés</div>
                        <div className="card-header">
                            <h3>Essentiel</h3>
                            <div className="price">{formatPrice(PLANS.essential.priceCents)}</div>
                            <p className="desc">La formule idéale pour collecter tous les souvenirs.</p>
                        </div>
                        <ul className="features-list">
                            <li><Check size={18} className="icon-rose" /> <strong>Invités illimités</strong></li>
                            <li><Check size={18} className="icon-rose" /> <strong>Photos illimitées</strong></li>
                            <li><Check size={18} className="icon-rose" /> Galerie disponible {PLANS.essential.galleryDuration}</li>
                            <li><Check size={18} className="icon-rose" /> Téléchargement ZIP HD</li>
                            <li><Check size={18} className="icon-rose" /> Chevalets QR code à vos noms</li>
                            <li className="disabled"><X size={18} /> Pas de Live Wall</li>
                        </ul>
                        <Link
                            href="/create?plan=essential"
                            className="btn-sage-primary big full-width"
                            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                        >
                            Choisir ce pack
                        </Link>
                    </div>

                    {/* PREMIUM */}
                    <div className="price-card premium">
                        <div className="card-header">
                            <div className="premium-title">
                                <h3>Premium</h3>
                                <Crown size={18} className="icon-gold" />
                            </div>
                            <div className="price">{formatPrice(PLANS.premium.priceCents)}</div>
                            <p className="desc">L'expérience complète avec animation sur écran géant.</p>
                        </div>
                        <ul className="features-list">
                            <li><Check size={18} className="icon-gold" /> Tout le pack Essentiel</li>
                            <li><Check size={18} className="icon-gold" /> <strong>Live Wall (Diaporama TV)</strong></li>
                            <li><Check size={18} className="icon-gold" /> <strong>Défis Photos (Jeu)</strong></li>
                            <li><Check size={18} className="icon-gold" /> Modération des photos</li>
                            <li><Check size={18} className="icon-gold" /> Support Prioritaire</li>
                        </ul>
                        <Link
                            href="/create?plan=premium"
                            className="btn-sage-primary full-width"
                            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                        >
                            L&apos;Expérience Ultime
                        </Link>
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
            <SiteFooter />
        </div>
    );
}
