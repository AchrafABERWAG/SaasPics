'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Photo, Challenge } from '@/types';
import { Zap } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface LiveGalleryProps {
  eventId: string;
  slug: string;
  eventData: {
    name: string;
    plan_type: 'discovery' | 'essential' | 'premium';
    groom_name?: string;
    bride_name?: string;
  };
}

export default function LiveGallery({ eventId, slug, eventData }: LiveGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploadUrl, setUploadUrl] = useState('');

  // Determine display title: either "Groom & Bride" or "Event Name"
  const displayTitle = (eventData.groom_name && eventData.bride_name)
    ? `${eventData.bride_name} & ${eventData.groom_name}`
    : eventData.name;

  useEffect(() => {
    setUploadUrl(`${window.location.origin}/event/${slug}`);
  }, [slug]);

  // 1. Initial Fetch
  useEffect(() => {
    async function fetchPhotos() {
      // Fetch specifically 7 photos for our bento grid (we handle empty slots in UI)
      const { data } = await supabase
        .from('photos')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', 'approved') // Only show approved photos
        .order('created_at', { ascending: false })
        .limit(7);

      if (data) setPhotos(data as Photo[]);
    }
    fetchPhotos();
  }, [eventId]);

  // 2. Realtime Subscription
  useEffect(() => {
    const channel = supabase
      .channel(`event:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT and UPDATE)
          schema: 'public',
          table: 'photos',
          filter: `event_id=eq.${eventId}`, // Status filtering happens in callback or RLS
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPhoto = payload.new as Photo;
            if (newPhoto.status === 'approved') {
              setPhotos((prev) => [newPhoto, ...prev].slice(0, 7));
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedPhoto = payload.new as Photo;
            if (updatedPhoto.status === 'approved') {
              setPhotos((prev) => {
                // Avoid duplicates
                if (prev.find(p => p.id === updatedPhoto.id)) return prev;
                return [updatedPhoto, ...prev].slice(0, 7);
              });
            } else if (updatedPhoto.status === 'rejected') {
              // Remove if rejected
              setPhotos((prev) => prev.filter(p => p.id !== updatedPhoto.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      .channel('public:challenges')
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
      .single();

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
function WallPhoto({ photo }: { photo: Photo | null }) {
  if (!photo) return null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <img
        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${photo.storage_path}`}
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