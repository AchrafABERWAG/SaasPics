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

            if (uploadError) throw uploadError;

            // Insert into DB
            const { error: dbError } = await supabase
                .from('photos')
                .insert({
                    event_id: item.eventId,
                    storage_path: item.fileName,
                    status: 'pending',
                });

            if (dbError) throw dbError;

            // Success: Remove from queue
            newQueue.shift();
            setQueue(newQueue);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));

            toast.dismiss('sync');
            toast.success('Photo synchronisée !');

        } catch (err) {
            console.error('Sync failed for item:', err);
            toast.dismiss('sync');
            toast.error('Erreur de synchro. On réessaiera plus tard.');
            // Keep in queue, maybe delay next retry?
        } finally {
            setIsSyncing(false);
        }
    };

    return {
        addToQueue,
        isOnline,
        queueLength: queue.length,
        isSyncing
    };
}
