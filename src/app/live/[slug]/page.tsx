'use client';

import { use, useEffect, useState } from 'react';
import LiveGallery from '@/components/LiveGallery';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

type Params = Promise<{ slug: string }>;

export default function LivePage({ params }: { params: Params }) {
    const { slug } = use(params);
    const [isValidId, setIsValidId] = useState<string | null>(null);
    const [eventName, setEventName] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        async function checkEvent() {
            // Find event ID and Name by slug
            const { data, error } = await supabase
                .from('events')
                .select('id, name')
                .eq('slug', slug)
                .single();

            if (data) {
                setIsValidId(data.id);
                setEventName(data.name);
            } else {
                setError(true);
            }
        }
        checkEvent();
    }, [slug]);

    if (error) return <div className="text-white bg-black h-screen flex items-center justify-center">Événement introuvable</div>;
    if (!isValidId) return <div className="bg-black h-screen flex items-center justify-center"><Loader2 className="text-white animate-spin" /></div>;

    return <LiveGallery eventId={isValidId} slug={slug} eventName={eventName || ''} />;
}
