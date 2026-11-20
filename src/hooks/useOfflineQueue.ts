'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import toast from 'react-hot-toast';
import { isNetworkError, sendPreparedPhoto, type PreparedPhoto } from '@/lib/upload';

// File d'attente hors ligne : les photos sont gardées dans IndexedDB (fichiers binaires,
// plusieurs centaines de Mo possibles) et renvoyées dès que le réseau revient.

type QueuedPhoto = {
    id: string;
    timestamp: number;
    photo?: PreparedPhoto;   // format actuel : photo déjà convertie, avec miniature
    // Ancien format (avant les miniatures) : fichier seul.
    blob?: Blob;
    fileName?: string;       // chemin de stockage : <event_id>/<uuid>.<ext>
    eventId?: string;
};

// Ancien format → photo préparée (sans miniature, prénom ni petit mot).
function toPrepared(item: QueuedPhoto): PreparedPhoto | null {
    if (item.photo) return item.photo;
    if (!item.blob || !item.fileName || !item.eventId) return null;
    const id = item.fileName.split('/')[1]?.replace(/\.[^.]+$/, '') ?? item.id;
    return {
        id, eventId: item.eventId, storagePath: item.fileName, thumbPath: '', blob: item.blob, thumb: null,
        guestName: null, caption: null, deleteToken: Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join(''),
    };
}

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
            await putItem({ id: item.id, blob, fileName: item.fileName, eventId: item.eventId, timestamp: item.timestamp });
        }
    } catch (err) {
        console.error('Legacy offline queue migration failed:', err);
    }
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
}

function subscribeOnline(onChange: () => void) {
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    return () => {
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
    };
}

export function useOfflineQueue() {
    const [queueLength, setQueueLength] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const isOnline = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
    const syncingRef = useRef(false);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const processRef = useRef<() => void>(() => {});

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
                    const photo = toPrepared(item);
                    if (photo) await sendPreparedPhoto(photo);
                    await deleteItem(item.id);
                    toast.success('Photo envoyée !');
                } catch (err) {
                    if (isNetworkError(err)) {
                        // Réseau encore instable : on réessaiera plus tard (sans boucler).
                        toast.error('Réseau instable, nouvel essai dans quelques secondes.', { id: 'sync' });
                        retryTimer.current = setTimeout(() => processRef.current(), RETRY_DELAY_MS);
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
        processRef.current = processQueue;
        const handleOnline = () => processQueue();
        window.addEventListener('online', handleOnline);

        migrateLegacyQueue().then(refreshCount).then(() => processQueue());

        return () => {
            window.removeEventListener('online', handleOnline);
            if (retryTimer.current) clearTimeout(retryTimer.current);
        };
    }, [processQueue, refreshCount]);

    // Garde des photos préparées sur le téléphone ; elles partiront au retour du réseau.
    const addToQueue = async (photos: PreparedPhoto[]) => {
        try {
            for (const photo of photos) await putItem({ id: photo.id, photo, timestamp: Date.now() });
            await refreshCount();
            toast(`${photos.length > 1 ? `${photos.length} photos gardées` : 'Photo gardée'} sur votre téléphone : envoi dès le retour du réseau.`, { icon: '💾' });
            processQueue();
        } catch (err) {
            console.error('Error queuing file:', err);
            toast.error("Impossible de garder la photo hors ligne (espace de stockage plein ?).");
        }
    };

    return { addToQueue, isOnline, queueLength, isSyncing };
}
