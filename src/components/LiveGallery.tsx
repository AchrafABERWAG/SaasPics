'use client';

import { useCallback, useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PublicEvent, PublicPhoto, Challenge } from '@/types';
import { fetchApprovedPhotos, photoUrl, subscribeToApprovedPhotos, thumbUrl } from '@/lib/events';
import { siteUrl } from '@/lib/brand';
import { useQrCode } from '@/hooks/useQrCode';
import { useWakeLock } from '@/hooks/useWakeLock';

const WALL_SIZE = 5;
// Filet de sécurité le jour J : relecture complète régulière (Wi-Fi de salle capricieux).
const REFRESH_MS = 60_000;

interface LiveGalleryProps {
  eventId: string;
  slug: string;
  eventData: Pick<PublicEvent, 'name' | 'plan_type' | 'groom_name' | 'bride_name'>;
}

export default function LiveGallery({ eventId, slug, eventData }: LiveGalleryProps) {
  const [photos, setPhotos] = useState<PublicPhoto[]>([]);
  const qr = useQrCode(`${siteUrl()}/event/${slug}`, 512);
  useWakeLock();

  const displayTitle = eventData.groom_name && eventData.bride_name
    ? `${eventData.bride_name} & ${eventData.groom_name}`
    : eventData.name;

  const reload = useCallback(() => {
    fetchApprovedPhotos(eventId, WALL_SIZE)
      .then(setPhotos)
      .catch((err) => console.error('Live Wall fetch error:', err));
  }, [eventId]);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, REFRESH_MS);
    const unsubscribe = subscribeToApprovedPhotos(
      eventId,
      (photo, visible) => setPhotos((prev) => {
        const without = prev.filter((p) => p.id !== photo.id);
        return visible ? [photo, ...without].slice(0, WALL_SIZE) : without;
      }),
      reload
    );
    return () => { clearInterval(timer); unsubscribe(); };
  }, [eventId, reload]);

  return (
    <div className="wall-container">
      <div className="wall-bg" />

      <header className="wall-header">
        <h1 className="wall-title">{displayTitle}</h1>
        <p className="wall-subtitle">Le Mur Live</p>
      </header>

      <main className="wall-grid">
        <div className="wall-card slot-main"><WallPhoto photo={photos[0] ?? null} main /></div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="wall-card"><WallPhoto photo={photos[i] ?? null} /></div>
        ))}
        {photos.length === 0 && (
          <p className="wall-empty">Les premières photos de vos invités vont apparaître ici…</p>
        )}
      </main>

      <footer className="wall-footer">
        <div className="wall-qr">
          {qr && <img src={qr} alt="QR code pour envoyer des photos" />}
        </div>
        <div className="wall-cta">
          Scannez pour partager<br />vos photos en direct !
        </div>
      </footer>

      {eventData.plan_type === 'premium' && <ChallengeWidget eventId={eventId} />}
    </div>
  );
}

function ChallengeWidget({ eventId }: { eventId: string }) {
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);

  useEffect(() => {
    const fetchChallenge = async () => {
      const { data } = await supabase
        .from('challenges')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .maybeSingle();
      setActiveChallenge(data as Challenge | null);
    };

    fetchChallenge();
    const channel = supabase
      .channel(`challenges:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges', filter: `event_id=eq.${eventId}` }, fetchChallenge)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

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

function WallPhoto({ photo, main = false }: { photo: PublicPhoto | null; main?: boolean }) {
  if (!photo) return null;
  return (
    <div className="wall-photo">
      {/* Grande case : photo HD ; petites cases : miniature, suffisante et plus légère. */}
      <img key={photo.id} src={main ? photoUrl(photo.storage_path) : thumbUrl(photo)} alt="" className="wall-photo-img" />
      <div className="wall-vignette" />
      {main && (photo.guest_name || photo.caption) && (
        <div className="wall-caption">
          {photo.caption && <span>« {photo.caption} »</span>}
          {photo.guest_name && <strong>{photo.guest_name}</strong>}
        </div>
      )}
    </div>
  );
}
