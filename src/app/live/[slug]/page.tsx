'use client';

import { use, useEffect, useState } from 'react';
import LiveGallery from '@/components/LiveGallery';
import { Loader2 } from 'lucide-react';
import { PublicEvent } from '@/types';
import { fetchPublicEvent } from '@/lib/events';

type Params = Promise<{ slug: string }>;

const screenStyle: React.CSSProperties = {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'black',
    color: 'white',
};

export default function LivePage({ params }: { params: Params }) {
    const { slug } = use(params);
    const [eventData, setEventData] = useState<PublicEvent | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetchPublicEvent(slug)
            .then((data) => (data ? setEventData(data) : setError(true)))
            .catch(() => setError(true));
    }, [slug]);

    if (error) return <div style={screenStyle}>Événement introuvable</div>;
    if (!eventData) return <div style={screenStyle}><Loader2 className="animate-spin" /></div>;

    return <LiveGallery eventId={eventData.id} slug={slug} eventData={eventData} />;
}
