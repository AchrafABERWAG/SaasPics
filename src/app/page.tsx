import Link from 'next/link';
import { Heart, Tv, Shield, Download } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import { BRAND } from '@/lib/brand';
import ScrollNav from '@/components/landing/ScrollNav';
import { DEMO_SLUG } from '@/lib/demo';

export default function LandingPage() {
  return (
    <main className="romance-wrapper">

      {/* 1. HEADER STICKY */}
      <ScrollNav>
        <div className="nav-container">
          <div className="nav-logo">
            <span className="logo-text">{BRAND.name}</span>
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
      </ScrollNav>

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
              <Link href={`/event/${DEMO_SLUG}`} className="btn-sage-outline big">
                Voir la démo
              </Link>
            </div>
            <p className="hero-demo-hint">
              Essayez comme un invité, puis découvrez la <Link href={`/event/${DEMO_SLUG}/gallery`}>galerie</Link> et
              le <Link href={`/live/${DEMO_SLUG}`} target="_blank">Mur Live</Link> d&apos;un vrai mariage de démonstration.
            </p>
          </div>

          <div className="hero-visual-arch">
            <div className="arch-frame">
              <img
                src="/images/hero.jpg"
                alt="Mains des mariés"
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
                  <div className="screen-header">{BRAND.name}</div>
                  <div className="screen-grid">
                    <img className="grid-item" src="/images/mock-petals.jpg" alt="" />
                    <img className="grid-item" src="/images/couple.jpg" alt="" />
                    <img className="grid-item" src="/images/mock-toast.jpg" alt="" />
                    <img className="grid-item" src="/images/pro.jpg" alt="" />
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
            <p>Récupérez l'intégralité des photos de vos invités en haute définition, dès le lendemain, en un seul téléchargement.</p>
          </div>
        </div>
      </section>

      {/* 4. APPEL FINAL */}
      <section className="romance-cta">
        <h2>Prêt à vivre votre mariage autrement&nbsp;?</h2>
        <p>Gratuit jusqu&apos;à 30 photos, sans application à installer. Passez au pack supérieur quand vous voulez.</p>
        <div className="hero-cta-group centered">
          <Link href="/create" className="btn-sage-primary big">Créer mon événement</Link>
          <Link href={`/event/${DEMO_SLUG}`} className="btn-sage-outline big">Voir la démo</Link>
        </div>
        <Link href="/pricing" className="cta-pricing-link">Comparer les packs et les tarifs</Link>
      </section>

      <SiteFooter />
    </main>
  );
}