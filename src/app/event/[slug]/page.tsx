'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import PhotoUploader from '@/components/PhotoUploader';
import { Loader2, Zap } from 'lucide-react';
import Link from 'next/link';
import { PublicEvent, Challenge } from '@/types';
import { fetchPublicEvent, uploadBlockReason } from '@/lib/events';

// Properly type the params for Next.js 15+ App Router
type Params = Promise<{ slug: string }>;

export default function EventPage({ params }: { params: Params }) {
  // Unwrap params using React.use()
  const { slug } = use(params);

  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvent() {
      if (!slug) return;

      try {
        const data = await fetchPublicEvent(slug);

        if (!data) {
          setError('Événement introuvable.');
        } else {
          setEvent(data);

          // Fetch Active Challenge (Premium only)
          if (data.plan_type === 'premium') {
            const { data: challengeData } = await supabase
              .from('challenges')
              .select('*')
              .eq('event_id', data.id)
              .eq('is_active', true)
              .maybeSingle();

            if (challengeData) {
              setActiveChallenge(challengeData as Challenge);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching event:', err);
        setError('Impossible de charger l\'événement.');
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [slug]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'black', color: 'white' }}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="landing-container">
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Oups ! 😕</h1>
        <p style={{ color: '#888', marginBottom: '2rem' }}>{error || "Cet événement n'existe pas."}</p>
        <Link href="/" className="landing-btn">
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  const blockReason = uploadBlockReason(event);

  return (
    <main className="guest-page-container">
      {/* Background */}
      <div className="guest-bg">
        <img src="https://images.unsplash.com/photo-1511285560982-135631174ea8?q=80&w=1920&auto=format&fit=crop" alt="Background" />
      </div>
      <div className="guest-overlay" />

      {/* Content */}
      <div className="guest-content">
        {/* Header */}
        <header className="guest-header">
          <h1 className="guest-title">{event.name}</h1>
          <div className="guest-divider" />
          <p className="guest-subtitle">Livre d'Or Numérique</p>
        </header>

        {/* Active Challenge Card (Gamification V2) */}
        {activeChallenge && (
          <div className="guest-challenge-card">
            <div className="guest-challenge-badge">
              <Zap size={14} fill="var(--gold-primary)" />
              DÉFI EN COURS
            </div>
            <h3 className="guest-challenge-title">{activeChallenge.title}</h3>
            {activeChallenge.description && (
              <p className="guest-challenge-desc">"{activeChallenge.description}"</p>
            )}
          </div>
        )}




        {/* Upload Interface */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {blockReason ? (
            <div style={{ textAlign: 'center', color: 'white', padding: '24px', background: 'rgba(0,0,0,0.35)', borderRadius: '16px' }}>
              <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>
                {blockReason === 'closed'
                  ? 'La galerie de cet événement est fermée.'
                  : `Cet événement a atteint sa limite de ${event.max_photos} photos.`}
              </p>
              <p style={{ color: '#ddd', fontSize: '0.95rem' }}>Merci d&apos;avoir partagé vos souvenirs !</p>
            </div>
          ) : (
            <PhotoUploader
              eventId={event.id}
              moderationEnabled={event.moderation_enabled}
              onUploadComplete={() => {
                // Garde le compteur à jour pour afficher "galerie pleine" sans recharger.
                setEvent(prev => prev && { ...prev, photo_count: prev.photo_count + 1 });
              }}
            />
          )}
        </div>

        <div style={{ textAlign: 'center', margin: '16px 0' }}>
          <Link href={`/event/${event.slug}/gallery`} style={{ color: 'white', textDecoration: 'underline', fontSize: '0.95rem' }}>
            Voir toutes les photos partagées
          </Link>
        </div>

        {!blockReason && (
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', textAlign: 'center', maxWidth: 480, margin: '0 auto 12px', lineHeight: 1.5 }}>
            En envoyant une photo, vous confirmez avoir l&apos;accord des personnes qui y figurent. Elle sera visible par les
            invités disposant du lien et par les organisateurs, puis supprimée à la fermeture de la galerie.{' '}
            <Link href="/confidentialite" style={{ color: 'white', textDecoration: 'underline' }}>Confidentialité</Link> ·{' '}
            <Link href="/cgv" style={{ color: 'white', textDecoration: 'underline' }}>CGU</Link>
          </p>
        )}

        {/* Footer */}
        <div className="guest-footer">
          <p>PARTAGEZ VOS MEILLEURS SOUVENIRS</p>
        </div>
      </div>
    </main>
  );
}