'use client';

import { useState, useEffect, use } from 'react';
import { PublicPhoto } from '@/types';
import { fetchApprovedPhotos, fetchPublicEvent, photoUrl, thumbUrl } from '@/lib/events';
import { useWakeLock } from '@/hooks/useWakeLock';
import { X, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PLANS } from '@/lib/plans';
import PremiumRequired from '@/components/PremiumRequired';

type Params = Promise<{ slug: string }>;

export default function SlideshowPage({ params }: { params: Params }) {
    const { slug } = use(params);
    const router = useRouter();

    const [photos, setPhotos] = useState<PublicPhoto[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [loading, setLoading] = useState(true);
    const [premiumRequired, setPremiumRequired] = useState(false);
    const [eventId, setEventId] = useState<string | null>(null);
    useWakeLock();

    // 1. Fetch Photos (approved only, Premium only)
    useEffect(() => {
        async function fetchPhotos() {
            try {
                const event = await fetchPublicEvent(slug);
                if (event && !PLANS[event.plan_type].liveWall) {
                    setPremiumRequired(true);
                } else if (event) {
                    setEventId(event.id);
                    setPhotos(await fetchApprovedPhotos(event.id, 200));
                }
            } catch (err) {
                console.error('Slideshow fetch error:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchPhotos();
    }, [slug]);

    // Les nouvelles photos rejoignent le diaporama (relecture toutes les 2 minutes).
    useEffect(() => {
        if (!eventId) return;
        const timer = setInterval(() => {
            fetchApprovedPhotos(eventId, 200).then(setPhotos).catch(() => {});
        }, 120_000);
        return () => clearInterval(timer);
    }, [eventId]);

    // Précharge la photo suivante : pas d'écran vide pendant la transition.
    useEffect(() => {
        const next = photos[(currentIndex + 1) % Math.max(photos.length, 1)];
        if (next) new Image().src = photoUrl(next.storage_path);
    }, [photos, currentIndex]);

    // 2. Auto-Play Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying && photos.length > 0) {
            interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % photos.length);
            }, 4000); // 4 seconds per slide
        }
        return () => clearInterval(interval);
    }, [isPlaying, photos.length]);

    // Navigation Handlers
    const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % photos.length);
    const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    const togglePlay = () => setIsPlaying((p) => !p);
    const exitSlideshow = () => router.back();

    // Keyboard Navigation
    useEffect(() => {
        const count = photos.length;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setCurrentIndex((prev) => (prev + 1) % count);
            if (e.key === 'ArrowLeft') setCurrentIndex((prev) => (prev - 1 + count) % count);
            if (e.key === ' ') { e.preventDefault(); setIsPlaying((p) => !p); }
            if (e.key === 'Escape') router.back();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [photos.length, router]);

    if (loading) return <div className="slideshow-loading">Chargement...</div>;
    if (premiumRequired) return <PremiumRequired feature="Le diaporama" slug={slug} />;
    if (photos.length === 0) return <div className="slideshow-empty">Aucune photo à afficher.</div>;

    const currentPhoto = photos[currentIndex % photos.length];

    return (
        <div className="slideshow-container">
            {/* Background (Blurred current image) */}
            <div className="slideshow-bg">
                <img
                    src={thumbUrl(currentPhoto)}
                    alt=""
                />
                <div className="slideshow-overlay" />
            </div>

            {/* Main Image */}
            <div className="slideshow-content">
                <img
                    key={currentPhoto.id} // Key forces re-render for animation
                    src={photoUrl(currentPhoto.storage_path)}
                    className="slide-image fade-in"
                    alt="Slideshow"
                />
            </div>

            {/* Controls (Hidden by default, hover to show?) - Let's keep them miniaml */}
            <div className="slideshow-controls">
                <button onClick={prevSlide} className="control-btn"><ChevronLeft /></button>
                <button onClick={togglePlay} className="control-btn">
                    {isPlaying ? <Pause /> : <Play />}
                </button>
                <button onClick={nextSlide} className="control-btn"><ChevronRight /></button>
                <button onClick={exitSlideshow} className="control-btn close"><X /></button>
            </div>

            {/* Progress Bar */}
            <div className="slideshow-progress">
                <div
                    className="progress-bar"
                    style={{ width: `${((currentIndex + 1) / photos.length) * 100}%` }}
                />
            </div>
        </div>
    );
}
