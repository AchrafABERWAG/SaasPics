'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import PhotoUploader from '@/components/PhotoUploader';
import { Loader2, Zap } from 'lucide-react';
import Link from 'next/link';
import { Event, Challenge } from '@/types';

// Properly type the params for Next.js 15+ App Router
type Params = Promise<{ slug: string }>;

export default function EventPage({ params }: { params: Params }) {
  // Unwrap params using React.use()
  const { slug } = use(params);

  const [event, setEvent] = useState<Event | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvent() {
      if (!slug) return;

      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, name, slug, date') // Explicit selection to avoid leaking 'passcode'
          .eq('slug', slug)
          .single();

        if (error) {
          // If 406 (Not Acceptable) or no rows, it means event not found
          if (error.code === 'PGRST116') {
            setError('Événement introuvable.');
          } else {
            throw error;
          }
        } else {
          setEvent(data as Event);

          // Fetch Active Challenge
          const { data: challengeData } = await supabase
            .from('challenges')
            .select('*')
            .eq('event_id', data.id)
            .eq('is_active', true)
            .single();

          if (challengeData) {
            setActiveChallenge(challengeData as Challenge);
          }
        }
      } catch (err: any) {
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
          <PhotoUploader
            eventId={event.id}
            moderationEnabled={event.moderation_enabled}
            onUploadComplete={() => {
              // Optional: Show a "Thank you" state
            }}
          />
        </div>

        {/* Footer */}
        <div className="guest-footer">
          <p>PARTAGEZ VOS MEILLEURS SOUVENIRS</p>
        </div>
      </div>
    </main>
  );
}