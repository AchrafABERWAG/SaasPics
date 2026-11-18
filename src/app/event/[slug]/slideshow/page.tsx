'use client';

import { useState, useEffect, use } from 'react';
import { PublicPhoto } from '@/types';
import { fetchApprovedPhotos, fetchPublicEvent, photoUrl } from '@/lib/events';
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

    // 1. Fetch Photos (approved only, Premium only)
    useEffect(() => {
        async function fetchPhotos() {
            try {
                const event = await fetchPublicEvent(slug);
                if (event && !PLANS[event.plan_type].liveWall) {
                    setPremiumRequired(true);
                } else if (event) {
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
    const togglePlay = () => setIsPlaying(!isPlaying);
    const exitSlideshow = () => router.back();

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
            if (e.key === ' ') togglePlay();
            if (e.key === 'Escape') exitSlideshow();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [photos.length]);

    if (loading) return <div className="slideshow-loading">Chargement...</div>;
    if (premiumRequired) return <PremiumRequired feature="Le diaporama" slug={slug} />;
    if (photos.length === 0) return <div className="slideshow-empty">Aucune photo à afficher.</div>;

    const currentPhoto = photos[currentIndex];

    return (
        <div className="slideshow-container">
            {/* Background (Blurred current image) */}
            <div className="slideshow-bg">
                <img
                    src={photoUrl(currentPhoto.storage_path)}
                    alt="Blur BG"
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
