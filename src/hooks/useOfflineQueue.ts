'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

// File d'attente hors ligne : les photos sont gardées dans IndexedDB (fichiers binaires,
// plusieurs centaines de Mo possibles) et renvoyées dès que le réseau revient.

type QueuedPhoto = {
    id: string;
    blob: Blob;
    fileName: string;      // chemin de stockage : <event_id>/<uuid>.<ext>
    eventId: string;
    contentType: string;
    timestamp: number;
};

const DB_NAME = 'saas_photo_offline';
const STORE = 'queue';
const LEGACY_KEY = 'saas_photo_queue'; // ancienne file (base64 dans localStorage)
const RETRY_DELAY_MS = 15000;

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

const putItem = (item: QueuedPhoto) => tx('readwrite', s => s.put(item));
const deleteItem = (id: string) => tx('readwrite', s => s.delete(id));
const allItems = async () => ((await tx('readonly', s => s.getAll())) as QueuedPhoto[]).sort((a, b) => a.timestamp - b.timestamp);

// Reprend les photos de l'ancienne file localStorage, puis la supprime.
async function migrateLegacyQueue() {
    let raw: string | null = null;
    try { raw = localStorage.getItem(LEGACY_KEY); } catch { return; }
    if (!raw) return;
    try {
        const legacy = JSON.parse(raw) as { id: string; fileBase64: string; fileName: string; eventId: string; timestamp: number }[];
        for (const item of legacy) {
            const blob = await (await fetch(item.fileBase64)).blob();
            await putItem({ id: item.id, blob, fileName: item.fileName, eventId: item.eventId, contentType: blob.type || 'image/jpeg', timestamp: item.timestamp });
        }
    } catch (err) {
        console.error('Legacy offline queue migration failed:', err);
    }
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
}

const isNetworkError = (message: string) => /failed to fetch|network|load failed/i.test(message);

export function useOfflineQueue() {
    const [queueLength, setQueueLength] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const syncingRef = useRef(false);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const refreshCount = useCallback(async () => {
        try { setQueueLength((await allItems()).length); } catch { setQueueLength(0); }
    }, []);

    // Envoie les photos en attente une par une, dans l'ordre.
    const processQueue = useCallback(async () => {
        if (syncingRef.current || !navigator.onLine) return;
        syncingRef.current = true;
        setIsSyncing(true);

        try {
            const items = await allItems();
            for (const [index, item] of items.entries()) {
                toast.loading(`Envoi des photos en attente… (${items.length - index})`, { id: 'sync' });
                try {
                    const { error: uploadError } = await supabase.storage
                        .from('photos')
                        .upload(item.fileName, item.blob, { contentType: item.contentType });
                    // "Duplicate" = le fichier est déjà parti lors d'une tentative précédente.
                    if (uploadError && !/duplicate|already exists/i.test(uploadError.message)) throw uploadError;

                    const { error: dbError } = await supabase
                        .from('photos')
                        .insert({ event_id: item.eventId, storage_path: item.fileName });
                    if (dbError && !/duplicate key/i.test(dbError.message)) throw dbError;

                    await deleteItem(item.id);
                    toast.success('Photo envoyée !');
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    if (isNetworkError(message)) {
                        // Réseau encore instable : on réessaiera plus tard (sans boucler).
                        toast.error('Réseau instable, nouvel essai dans quelques secondes.', { id: 'sync' });
                        retryTimer.current = setTimeout(() => processQueue(), RETRY_DELAY_MS);
                        return;
                    }
                    // Refus définitif du serveur (limite atteinte, galerie fermée...) : on abandonne cette photo.
                    await deleteItem(item.id);
                    toast.error("Une photo en attente n'a pas pu être envoyée (limite atteinte ou galerie fermée).");
                }
            }
            toast.dismiss('sync');
        } catch (err) {
            console.error('Offline queue error:', err);
            toast.dismiss('sync');
        } finally {
            syncingRef.current = false;
            setIsSyncing(false);
            refreshCount();
        }
    }, [refreshCount]);

    useEffect(() => {
        if (typeof indexedDB === 'undefined') return;
        const handleOnline = () => { setIsOnline(true); processQueue(); };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        setIsOnline(navigator.onLine);

        migrateLegacyQueue().then(refreshCount).then(() => processQueue());

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (retryTimer.current) clearTimeout(retryTimer.current);
        };
    }, [processQueue, refreshCount]);

    const addToQueue = async (file: File, eventId: string, fileName: string) => {
        try {
            await putItem({ id: uuidv4(), blob: file, fileName, eventId, contentType: file.type || 'image/jpeg', timestamp: Date.now() });
            await refreshCount();
            toast('Photo gardée sur votre téléphone : elle sera envoyée dès le retour du réseau.', { icon: '💾' });
            processQueue();
        } catch (err) {
            console.error('Error queuing file:', err);
            toast.error("Impossible de garder la photo hors ligne (espace de stockage plein ?).");
        }
    };

    return { addToQueue, isOnline, queueLength, isSyncing };
}
