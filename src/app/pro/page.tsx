'use client';

import Link from 'next/link';
import { TrendingUp, Smartphone, Heart, ArrowLeft, Send } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import { BRAND } from '@/lib/brand';

export default function ProPage() {
    return (
        <div className="romance-wrapper">

            {/* Navbar Minimal */}
            <nav className="romance-nav">
                <div className="nav-container">
                    <Link href="/" className="nav-back-link">
                        <ArrowLeft size={20} /> <span className="nav-back-text">Retour à l'accueil</span>
                    </Link>
                    <div className="nav-logo">
                        <span className="logo-text">{BRAND.proName}</span>
                    </div>
                    <Link href="/pro/dashboard" className="btn-sage-outline sm">
                        Espace Pro
                    </Link>
                </div>
            </nav>

            {/* Hero Pro */}
            <section className="pro-hero">
                <div className="pro-hero-content">
                    <h1>Offrez une expérience <span className="serif-highlight">inoubliable</span>.</h1>
                    <p className="subtitle">
                        Photographes, Wedding Planners : intégrez {BRAND.name} à vos offres
                        pour moderniser vos prestations et générer des revenus additionnels.
                    </p>
                    <div className="cta-group">
                        <Link href="/pro/signup" className="btn-sage-primary big">Devenir Partenaire</Link>
                    </div>
                </div>
                <div className="pro-visual">
                    <img
                        src="/images/pro.jpg"
                        alt="Photographe de mariage"
                        className="hero-img-wide"
                    />
                </div>
            </section>

            {/* 3 Value Points (Refined) */}
            <section className="pro-features">
                <div className="features-grid-3">
                    <div className="feature-item">
                        <TrendingUp size={40} className="icon-sage" />
                        <h3>Revenus Additionnels</h3>
                        <p>Devenez apporteur d'affaires. Touchez une commission de 20% sur chaque événement {BRAND.name} vendu à vos clients ou intégrez-le directement dans vos packages.</p>
                    </div>
                    <div className="feature-item">
                        <Smartphone size={40} className="icon-sage" />
                        <h3>Modernité</h3>
                        <p>Proposez une alternative digitale et ludique aux appareils jetables. Le Live Wall et les QR Codes apportent une touche "Tech & Fun" instantanée.</p>
                    </div>
                    <div className="feature-item">
                        <Heart size={40} className="icon-sage" />
                        <h3>Satisfaction Client</h3>
                        <p>Offrez à vos mariés ce qu'ils désirent le plus : 100% des photos de leurs amis, sans effort, livrées dès le lendemain en HD.</p>
                    </div>
                </div>
            </section>

            {/* Candidature */}
            <section className="pro-form-section" id="apply">
                <div className="typeform-container" style={{ textAlign: 'center' }}>
                    <header className="form-header">
                        <h2>Rejoindre le réseau</h2>
                        <p>Présentez votre activité en 2 minutes. Nous validons chaque candidature sous 48 h ;
                            vous recevez ensuite votre lien personnel et suivez vos commissions depuis votre espace.</p>
                    </header>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link href="/pro/signup" className="btn-rose-primary typeform-submit" style={{ display: 'inline-flex', alignItems: 'center' }}>
                            Envoyer ma candidature <Send size={18} style={{ marginLeft: 10 }} />
                        </Link>
                        <Link href="/pro/login" className="btn-sage-outline">Déjà partenaire ? Se connecter</Link>
                    </div>
                </div>
            </section>

            <SiteFooter />
        </div>
    );
}
