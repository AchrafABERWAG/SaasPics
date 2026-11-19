'use client';

import Link from 'next/link';
import { Camera, Heart, Tv, Shield, Download, Smartphone, Star, PlayCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import SiteFooter from '@/components/SiteFooter';

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <main className="romance-wrapper">

      {/* 1. HEADER STICKY */}
      <nav className={`romance-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-container">
          <div className="nav-logo">
            <span className="logo-text">Lumina</span>
          </div>

          <div className="nav-links desktop-only">
            <a href="#features">Fonctionnalités</a>
            <Link href="/pricing">Tarification</Link>
            <Link href="/pro">Pour les Pros</Link>
            <Link href="/dashboard">Mon espace</Link>
          </div>

          <Link href="/create" className="btn-sage-primary sm">
            Créer Gratuitement
          </Link>
        </div>
      </nav>

      {/* 2. HERO SECTION (Romantic Arch) */}
      <section className="romance-hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Capturez l'émotion.<br />
              <span className="serif-highlight">Partagez l'instant.</span>
            </h1>
            <p className="hero-subtitle">
              La solution tout-en-un pour collecter, diffuser et conserver
              les souvenirs de vos invités.
            </p>
            <div className="hero-cta-group">
              <Link href="/create" className="btn-sage-primary big">
                Créer mon événement
              </Link>
            </div>
          </div>

          <div className="hero-visual-arch">
            <div className="arch-frame">
              <img
                src="https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=2070&auto=format&fit=crop"
                alt="Wedding Hands"
                className="arch-img"
              />

              {/* Floating Badges */}
              <div className="float-badge top-right">
                <Tv size={16} /> Live Wall
              </div>
              <div className="float-badge bottom-left">
                <Download size={16} /> HD Photos
              </div>

              {/* Smartphone Mockup Overlay */}
              <div className="phone-overlay">
                <div className="phone-screen">
                  <div className="screen-header">Lumina</div>
                  <div className="screen-grid">
                    <div className="grid-item"></div>
                    <div className="grid-item"></div>
                    <div className="grid-item"></div>
                    <div className="grid-item"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FEATURES (Elegant Grid) */}
      <section className="romance-features" id="features">
        <div className="section-header">
          <span className="overline-rose">FONCTIONNALITÉS</span>
          <h2 className="section-title">Tout ce dont vous avez besoin.</h2>
        </div>

        <div className="features-grid">
          {/* Card 1 */}
          <div className="romance-card">
            <div className="card-icon sage-circle">
              <Tv size={24} color="white" />
            </div>
            <h3>Live Wall Immersif</h3>
            <p>Diffusez les photos en temps réel sur grand écran. Créez une animation visuelle qui captive vos invités.</p>
          </div>

          {/* Card 2 */}
          <div className="romance-card">
            <div className="card-icon rose-circle">
              <Heart size={24} color="white" />
            </div>
            <h3>Les Grands Défis</h3>
            <p>Brisez la glace. Lancez des défis (ex: 'Selfie avec la mariée') pour transformer la prise de photo en jeu.</p>
          </div>

          {/* Card 3 */}
          <div className="romance-card">
            <div className="card-icon sage-circle">
              <Shield size={24} color="white" />
            </div>
            <h3>Contrôle Total</h3>
            <p>Validez les photos avant qu'elles n'apparaissent sur l'écran et supprimez les indésirables d'un clic.</p>
          </div>

          {/* Card 4 */}
          <div className="romance-card">
            <div className="card-icon rose-circle">
              <Download size={24} color="white" />
            </div>
            <h3>Téléchargement ZIP</h3>
            <p>Récupérez l'intégralité des photos et vidéos en Haute Définition le lendemain, en un seul dossier.</p>
          </div>
        </div>
      </section>

      {/* 4. FINAL CTA (Sage/Cream Split) */}
      <section className="romance-cta">
        <div className="cta-split-container">
          <div className="cta-text-side">
            <h2>Prêt à moderniser votre mariage ?</h2>
            <Link href="/pricing" className="btn-rose-primary">
              Voir les tarifs
            </Link>
          </div>
          <div className="cta-visual-side">
            {/* Abstract Line Art or Mockup */}
            <div className="mockup-outline">
              <Smartphone size={150} strokeWidth={0.5} color="var(--sage-dark)" />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}