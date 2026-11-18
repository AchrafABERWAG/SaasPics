import { supabase } from '@/lib/supabase';
import type { PublicEvent, PublicPhoto } from '@/types';

export function photoUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${storagePath}`;
}

// Données publiques d'un événement (RPC : ne renvoie que les champs non sensibles).
export async function fetchPublicEvent(slug: string): Promise<PublicEvent | null> {
  const { data, error } = await supabase.rpc('get_event_public', { p_slug: slug }).maybeSingle();
  if (error) throw error;
  return (data as PublicEvent | null) ?? null;
}

// Photos approuvées, de la plus récente à la plus ancienne.
export async function fetchApprovedPhotos(
  eventId: string,
  limit = 60,
  before?: string
): Promise<PublicPhoto[]> {
  const { data, error } = await supabase.rpc('get_event_photos', {
    p_event_id: eventId,
    p_limit: limit,
    p_before: before ?? null,
  });
  if (error) throw error;
  return (data as PublicPhoto[]) ?? [];
}

type PhotoBroadcast = PublicPhoto & { visible: boolean };

// Temps réel public : reçoit les photos approuvées (visible=true) ou retirées (visible=false).
// Alimenté par le trigger SQL broadcast_photo_change. Renvoie la fonction de désabonnement.
export function subscribeToApprovedPhotos(
  eventId: string,
  onChange: (photo: PublicPhoto, visible: boolean) => void
): () => void {
  const channel = supabase
    .channel(`event-photos:${eventId}`)
    .on('broadcast', { event: 'photo' }, ({ payload }) => {
      const { visible, ...photo } = payload as PhotoBroadcast;
      onChange(photo, visible);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Traduit les erreurs levées par les triggers SQL en messages lisibles.
export function friendlyDbError(message: string | undefined): string {
  if (!message) return 'Une erreur est survenue.';
  if (message.includes('PHOTO_LIMIT_REACHED')) return 'Cet événement a atteint sa limite de photos.';
  if (message.includes('EVENT_EXPIRED')) return "La galerie de cet événement est fermée.";
  if (message.includes('FREE_EVENT_LIMIT')) return "Vous avez atteint le nombre maximum d'événements gratuits.";
  if (message.includes('PREMIUM_REQUIRED')) return 'Cette fonctionnalité est réservée au pack Premium.';
  if (message.includes('EVENT_NOT_FOUND')) return 'Événement introuvable.';
  return message;
}
