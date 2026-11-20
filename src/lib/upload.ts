'use client';

import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import { friendlyDbError, newPhotoPaths } from '@/lib/events';

// Envoi des photos des invités : préparation dans le navigateur (JPEG + miniature), envoi au
// stockage puis enregistrement en base. Utilisé par l'envoi direct et par la file hors ligne.

export type PreparedPhoto = {
    id: string;                // = nom du fichier (uuid)
    eventId: string;
    storagePath: string;
    thumbPath: string;
    blob: Blob;                // JPEG ≤ 3840 px
    thumb: Blob | null;        // JPEG ≈ 480 px (null si la miniature n'a pas pu être créée)
    guestName: string | null;
    caption: string | null;
    deleteToken: string;       // permet à l'invité de supprimer sa photo pendant 10 minutes
};

export const OWN_DELETE_WINDOW_MS = 10 * 60 * 1000;

function randomToken(): string {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// Toujours en JPEG : affichable partout, et léger (même pour un HEIC, un PNG ou un RAW d'iPhone).
export async function preparePhoto(
    file: File,
    meta: { eventId: string; guestName?: string | null; caption?: string | null }
): Promise<PreparedPhoto> {
    const blob = await imageCompression(file, {
        maxSizeMB: 5, maxWidthOrHeight: 3840, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.85,
    });
    if (blob.type !== 'image/jpeg') throw new Error(`UNSUPPORTED_FORMAT:${blob.type}`);

    let thumb: Blob | null = null;
    try {
        thumb = await imageCompression(blob, {
            maxSizeMB: 0.1, maxWidthOrHeight: 480, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.75,
        });
    } catch (err) {
        console.warn('Thumbnail failed:', err);
    }

    const { storagePath, thumbPath } = newPhotoPaths(meta.eventId);
    return {
        id: storagePath.split('/')[1].replace(/\.jpg$/, ''),
        eventId: meta.eventId,
        storagePath,
        thumbPath,
        blob,
        thumb,
        guestName: meta.guestName?.trim().slice(0, 40) || null,
        caption: meta.caption?.trim().slice(0, 280) || null,
        deleteToken: randomToken(),
    };
}

const alreadyThere = (message: string) => /duplicate|already exists/i.test(message);

// Envoie une photo préparée. Rejoue sans risque : un fichier ou une ligne déjà présents
// (tentative précédente interrompue) ne sont pas considérés comme des erreurs.
export async function sendPreparedPhoto(photo: PreparedPhoto): Promise<void> {
    const bucket = supabase.storage.from('photos');
    const { error: uploadError } = await bucket.upload(photo.storagePath, photo.blob, { contentType: 'image/jpeg' });
    if (uploadError && !alreadyThere(uploadError.message)) throw uploadError;

    let thumbPath: string | null = null;
    if (photo.thumb) {
        const { error } = await bucket.upload(photo.thumbPath, photo.thumb, { contentType: 'image/jpeg' });
        if (!error || alreadyThere(error.message)) thumbPath = photo.thumbPath;
    }

    const { error: dbError } = await supabase.from('photos').insert({
        id: photo.id,
        event_id: photo.eventId,
        storage_path: photo.storagePath,
        thumb_path: thumbPath,
        guest_name: photo.guestName,
        caption: photo.caption,
        delete_token_hash: photo.deleteToken, // la base n'en garde que l'empreinte
    });
    if (dbError && !/duplicate key/i.test(dbError.message)) throw dbError;

    rememberOwnUpload({ photoId: photo.id, eventId: photo.eventId, token: photo.deleteToken, at: Date.now() });
}

export function isNetworkError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return (typeof navigator !== 'undefined' && !navigator.onLine) || /failed to fetch|network|load failed|timeout/i.test(message);
}

export function uploadErrorMessage(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('UNSUPPORTED_FORMAT')) return "Ce format de photo n'est pas pris en charge par votre téléphone.";
    // Le refus du stockage (politique can_upload_photo) arrive sous forme d'erreur RLS générique.
    if (/row-level security|unauthorized|403/i.test(message)) return 'Envoi refusé : la limite de photos est atteinte ou la galerie est fermée.';
    if (/payload too large|413|mime/i.test(message)) return 'Ce fichier est trop lourd ou dans un format non supporté.';
    return friendlyDbError(message);
}

// ---------------------------------------------------------------------------------------------
// Ce que le téléphone de l'invité retient (localStorage) : son prénom et ses derniers envois.
// ---------------------------------------------------------------------------------------------
const NAME_KEY = 'guest_name';
const OWN_KEY = 'own_uploads';

export type OwnUpload = { photoId: string; eventId: string; token: string; at: number };

export function loadGuestName(): string {
    try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}

export function saveGuestName(name: string) {
    try { localStorage.setItem(NAME_KEY, name.trim().slice(0, 40)); } catch { /* stockage indisponible */ }
}

export function loadOwnUploads(): OwnUpload[] {
    try {
        const all = JSON.parse(localStorage.getItem(OWN_KEY) ?? '[]') as OwnUpload[];
        return all.filter(u => Date.now() - u.at < OWN_DELETE_WINDOW_MS);
    } catch {
        return [];
    }
}

function rememberOwnUpload(upload: OwnUpload) {
    try { localStorage.setItem(OWN_KEY, JSON.stringify([...loadOwnUploads(), upload])); } catch { /* stockage indisponible */ }
}

export function forgetOwnUpload(photoId: string) {
    try { localStorage.setItem(OWN_KEY, JSON.stringify(loadOwnUploads().filter(u => u.photoId !== photoId))); } catch { /* ignore */ }
}
