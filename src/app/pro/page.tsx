'use client';

import Link from 'next/link';
import { TrendingUp, Smartphone, Heart, ArrowLeft, Send } from 'lucide-react';

export default function ProPage() {
    return (
        <div className="romance-wrapper">

            {/* Navbar Minimal */}
            <nav className="romance-nav">
                <div className="nav-container">
                    <Link href="/" className="nav-back-link">
                        <ArrowLeft size={20} /> Retour à l'accueil
                    </Link>
                    <div className="nav-logo">
                        <span className="logo-text">Lumina Pro</span>
                    </div>
                    <Link href="/auth/pro-login" className="btn-sage-outline sm">
                        Espace Pro
                    </Link>
                </div>
            </nav>

            {/* Hero Pro */}
            <section className="pro-hero">
                <div className="pro-hero-content">
                    <h1>Offrez une expérience <span className="serif-highlight">inoubliable</span>.</h1>
                    <p className="subtitle">
                        Photographes, Wedding Planners : intégrez Lumina à vos offres
                        pour moderniser vos prestations et générer des revenus additionnels.
                    </p>
                    <div className="cta-group">
                        <a href="#apply" className="btn-sage-primary big">Devenir Partenaire</a>
                    </div>
                </div>
                <div className="pro-visual">
                    <img
                        src="https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop"
                        alt="Wedding Photographer"
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
                        <p>Devenez apporteur d'affaires. Touchez une commission de 20% sur chaque événement Lumina vendu à vos clients ou intégrez-le prémierement dans vos packages.</p>
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

            {/* Qualification Form (Typeform Style) */}
            <section className="pro-form-section" id="apply">
                <div className="typeform-container">
                    <header className="form-header">
                        <h2>Rejoindre le réseau</h2>
                        <p>Dites-nous en plus sur votre activité pour recevoir votre invitation.</p>
                    </header>

                    <form className="elegant-form">
                        <div className="form-step">
                            <label>Comment vous appelez-vous ?</label>
                            <input type="text" placeholder="Votre Prénom et Nom" className="clean-input" />
                        </div>

                        <div className="form-step">
                            <label>Quelle est votre activité principale ?</label>
                            <select className="clean-input">
                                <option>Photographe</option>
                                <option>Wedding Planner</option>
                                <option>Lieu de Réception</option>
                                <option>DJ / Animateur</option>
                                <option>Autre</option>
                            </select>
                        </div>

                        <div className="form-step">
                            <label>Votre Site Web ou Instagram</label>
                            <input type="text" placeholder="www.mon-site.com" className="clean-input" />
                        </div>

                        <div className="form-step">
                            <label>Combien de mariages réalisez-vous par an ?</label>
                            <div className="radio-group-horizontal">
                                <label><input type="radio" name="weddings" /> 1-10</label>
                                <label><input type="radio" name="weddings" /> 10-30</label>
                                <label><input type="radio" name="weddings" /> 30+</label>
                            </div>
                        </div>

                        <button 
                            type="button" 
                            className="btn-rose-primary typeform-submit"
                            onClick={() => {
                                alert("Merci ! Votre candidature a bien été envoyée. Nous vous contacterons sous 48h.");
                            }}
                        >
                            Envoyer ma candidature <Send size={18} style={{ marginLeft: 10 }} />
                        </button>
                    </form>
                </div>
            </section>

        </div>
    );
}
