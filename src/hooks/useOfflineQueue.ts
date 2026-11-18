'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

export interface QueuedPhoto {
    id: string;
    fileBase64: string; // We store as base64 in LocalStorage
    fileName: string;
    eventId: string;
    timestamp: number;
}

const STORAGE_KEY = 'saas_photo_queue';
const RETRY_DELAY_MS = 15000;

export function useOfflineQueue() {
    const [queue, setQueue] = useState<QueuedPhoto[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isOnline, setIsOnline] = useState(true);

    // 1. Initialize & Listeners
    useEffect(() => {
        // Load queue from local storage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            setQueue(JSON.parse(stored));
        }

        // Network listeners
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check
        setIsOnline(navigator.onLine);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 2. Sync Logic (Triggered when online or queue changes)
    useEffect(() => {
        if (isOnline && queue.length > 0 && !isSyncing) {
            processQueue();
        }
    }, [isOnline, queue.length, isSyncing]);

    /**
     * Helper to convert File to Base64
     */
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    };

    /**
     * Helper to convert Base64 back to Blob/File for upload
     */
    const base64ToBlob = async (base64: string): Promise<Blob> => {
        const res = await fetch(base64);
        return await res.blob();
    };

    /**
     * Add a photo to the offline queue
     */
    const addToQueue = async (file: File, eventId: string, fileName: string) => {
        try {
            const base64 = await fileToBase64(file);
            const newItem: QueuedPhoto = {
                id: uuidv4(),
                fileBase64: base64,
                fileName,
                eventId,
                timestamp: Date.now(),
            };

            const newQueue = [...queue, newItem];
            setQueue(newQueue);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));
            toast('Photo sauvegardée hors-ligne (Envoi automatique dès le retour du réseau) 📡', {
                icon: '💾',
                duration: 4000,
            });
        } catch (err) {
            console.error('Error queuing file:', err);
            toast.error('Erreur de sauvegarde locale.');
        }
    };

    /**
     * Process the queue (Upload one by one)
     */
    const processQueue = async () => {
        setIsSyncing(true);
        const newQueue = [...queue];

        try {
            // Process first item
            const item = newQueue[0];
            toast.loading(`Synchronisation... (${newQueue.length} restantes)`, { id: 'sync' });

            // Convert back to Blob
            const blob = await base64ToBlob(item.fileBase64);
            const file = new File([blob], item.fileName, { type: 'image/jpeg' }); // Assume JPEG from compression

            // Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('photos')
                .upload(item.fileName, file);

            // "Duplicate" = le fichier est déjà parti lors d'une tentative précédente.
            if (uploadError && !/duplicate|already exists/i.test(uploadError.message)) throw uploadError;

            // Insert into DB (le statut est fixé par la base)
            const { error: dbError } = await supabase
                .from('photos')
                .insert({
                    event_id: item.eventId,
                    storage_path: item.fileName,
                });

            if (dbError && !/duplicate key/i.test(dbError.message)) throw dbError;

            // Success: Remove from queue
            removeFirst(newQueue);

            toast.dismiss('sync');
            toast.success('Photo synchronisée !');
            setIsSyncing(false);

        } catch (err) {
            console.error('Sync failed for item:', err);
            toast.dismiss('sync');
            const message = err instanceof Error ? err.message : String(err);

            if (/failed to fetch|network|load failed/i.test(message)) {
                toast.error('Erreur de synchro. On réessaiera plus tard.');
                // Attendre avant la prochaine tentative (évite de boucler sans fin).
                setTimeout(() => setIsSyncing(false), RETRY_DELAY_MS);
            } else {
                // Refus définitif du serveur (limite atteinte, galerie fermée...) : on abandonne cette photo.
                toast.error("Une photo en attente n'a pas pu être envoyée (limite atteinte ou galerie fermée).");
                removeFirst(newQueue);
                setIsSyncing(false);
            }
        }
    };

    const removeFirst = (current: QueuedPhoto[]) => {
        current.shift();
        setQueue([...current]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    };

    return {
        addToQueue,
        isOnline,
        queueLength: queue.length,
        isSyncing
    };
}
