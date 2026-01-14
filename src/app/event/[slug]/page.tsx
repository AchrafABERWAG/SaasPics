import { supabase } from '@/lib/supabase';
import PhotoUploader from '@/components/PhotoUploader';
import LiveGallery from '@/components/LiveGallery';
import { notFound } from 'next/navigation';
import { Toaster } from 'react-hot-toast';

export const dynamic = 'force-dynamic';

// Note le changement ici : params est maintenant une Promise
type Props = {
  params: Promise<{ slug: string }>;
};

export default async function EventPage({ params }: Props) {
  // 1. IMPORTANT : On doit "attendre" (await) les paramètres dans Next.js 15+
  const { slug } = await params;

  // 2. Récupérer l'ID de l'event via le slug
  const { data: event } = await supabase
    .from('events')
    .select('id, name')
    .eq('slug', slug) // On utilise le slug qu'on vient d'attendre
    .single();

  if (!event) return notFound();

  // 3. Récupérer les photos existantes
  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b px-4 py-4 text-center shadow-sm">
        <h1 className="font-bold text-xl text-black">{event.name}</h1>
      </header>
      
      <div className="p-1">
        <LiveGallery eventId={event.id} initialPhotos={photos || []} />
      </div>

      <PhotoUploader eventId={event.id} />
      <Toaster />
    </main>
  );
}