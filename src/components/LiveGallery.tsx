'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Photo } from '@/types';
import Image from 'next/image';

interface Props {
  eventId: string;
  initialPhotos: Photo[];
}

export default function LiveGallery({ eventId, initialPhotos }: Props) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);

  useEffect(() => {
    const channel = supabase
      .channel('realtime-photos')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photos',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          setPhotos((prev) => [payload.new as Photo, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  if (photos.length === 0) {
    return <div className="text-center py-20 text-gray-400">Aucune photo. Sois le premier !</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-1 pb-32">
      {photos.map((photo) => (
        <div key={photo.id} className="relative aspect-square bg-gray-100">
          <Image
            src={photo.url}
            alt="Souvenir"
            fill
            className="object-cover"
            sizes="50vw"
          />
        </div>
      ))}
    </div>
  );
}