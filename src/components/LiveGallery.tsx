'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PublicEvent, PublicPhoto, Challenge } from '@/types';
import { fetchApprovedPhotos, photoUrl, subscribeToApprovedPhotos } from '@/lib/events';
import { Zap } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { siteUrl } from '@/lib/brand';

const WALL_SIZE = 7;

interface LiveGalleryProps {
  eventId: string;
  slug: string;
  eventData: Pick<PublicEvent, 'name' | 'plan_type' | 'groom_name' | 'bride_name'>;
}

export default function LiveGallery({ eventId, slug, eventData }: LiveGalleryProps) {
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const [uploadUrl, setUploadUrl] = useState('');

  // Determine display title: either "Groom & Bride" or "Event Name"
  const displayTitle = (eventData.groom_name && eventData.bride_name)
    ? `${eventData.bride_name} & ${eventData.groom_name}`
    : eventData.name;

  useEffect(() => {
    setUploadUrl(`${siteUrl()}/event/${slug}`);
  }, [slug]);

  // 1. Initial Fetch (approved photos only, via RPC)
  useEffect(() => {
    fetchApprovedPhotos(eventId, WALL_SIZE)
      .then(setPhotos)
      .catch((err) => console.error('Live Wall fetch error:', err));
  }, [eventId]);

  // 2. Realtime: photos approuvées ou retirées (canal public alimenté par la base)
  useEffect(() => {
    return subscribeToApprovedPhotos(eventId, (photo, visible) => {
      setPhotos((prev) => {
        const without = prev.filter((p) => p.id !== photo.id);
        return visible ? [photo, ...without].slice(0, WALL_SIZE) : without;
      });
    });
  }, [eventId]);

  // Helper to get photo at index or placeholder
  const getPhoto = (index: number) => photos[index] || null;

  return (
    <div className="wall-container">
      {/* Dynamic Background */}
      <div className="wall-bg" />

      {/* Header */}
      <header className="wall-header">
        <h1 className="wall-title">
          {displayTitle}
        </h1>
        <p className="wall-subtitle">Le Mur Live</p>
      </header>

      {/* Bento Grid */}
      <main className="wall-grid">
        {/* Main Slot (Left Large) */}
        <div className="wall-card slot-main">
          <WallPhoto photo={getPhoto(0)} />
        </div>

        {/* Satellite Slots */}
        <div className="wall-card"> <WallPhoto photo={getPhoto(1)} /> </div>
        <div className="wall-card"> <WallPhoto photo={getPhoto(2)} /> </div>
        <div className="wall-card"> <WallPhoto photo={getPhoto(3)} /> </div>
        <div className="wall-card"> <WallPhoto photo={getPhoto(4)} /> </div>
      </main>

      {/* Footer / QR */}
      <footer className="wall-footer">
        <div className="wall-qr">
          <div style={{ width: '100%', height: '100%' }}>
            {uploadUrl && <QRCodeCanvas value={uploadUrl} size={256} style={{ width: '100%', height: '100%' }} />}
          </div>
        </div>
        <div className="wall-cta">
          Scannez pour partager<br />vos photos en direct !
        </div>
      </footer>

      {/* --- Gamification V2 Widget --- */}
      {eventData.plan_type === 'premium' && <ChallengeWidget eventId={eventId} />}
    </div>
  );
}

// Separate component for Challenge Widget to keep main logic clean
function ChallengeWidget({ eventId }: { eventId: string }) {
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);

  useEffect(() => {
    // Initial Fetch
    fetchChallenge();

    // Subscribe to changes
    const channel = supabase
      .channel(`challenges:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenges',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          fetchChallenge(); // Refresh on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const fetchChallenge = async () => {
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_active', true)
      .maybeSingle();

    // If no data (error), sets null
    setActiveChallenge(data as Challenge | null);
  };

  if (!activeChallenge) return null;

  return (
    <div className="wall-challenge-widget">
      <div className="widget-header">
        <Zap size={20} fill="#D4AF37" />
        <span>DÉFI EN COURS</span>
      </div>
      <div className="widget-content">
        <h3>{activeChallenge.title}</h3>
        {activeChallenge.description && <p>{activeChallenge.description}</p>}
      </div>
    </div>
  );
}

// Sub-component for individual photos
function WallPhoto({ photo }: { photo: PublicPhoto | null }) {
  if (!photo) return null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <img
        src={photoUrl(photo.storage_path)}
        alt="Live Moment"
      />
      {/* Vignette Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle, transparent 70%, rgba(0,0,0,0.4) 100%)'
      }} />
    </div>
  );
}