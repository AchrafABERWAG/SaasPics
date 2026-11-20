'use client';

import { useState, useRef } from 'react';
import { Camera, Loader2, X, WifiOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import imageCompression from 'browser-image-compression';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { friendlyDbError } from '@/lib/events';

function isNetworkError(message: string): boolean {
  return (typeof navigator !== 'undefined' && !navigator.onLine) || /failed to fetch|network|load failed/i.test(message);
}

function uploadRefusalMessage(message: string): string {
  // Le refus du stockage (politique can_upload_photo) arrive sous forme d'erreur RLS générique.
  if (/row-level security|unauthorized|403/i.test(message)) {
    return "Envoi refusé : la limite de photos est atteinte ou la galerie est fermée.";
  }
  if (/payload too large|413|mime/i.test(message)) {
    return 'Ce fichier est trop lourd ou dans un format non supporté.';
  }
  return friendlyDbError(message);
}

interface PhotoUploaderProps {
  eventId: string;
  moderationEnabled?: boolean;
  onUploadComplete: () => void;
}

export default function PhotoUploader({ eventId, moderationEnabled = false, onUploadComplete }: PhotoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addToQueue, isOnline, queueLength } = useOfflineQueue();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => selectFile(e.target.files?.[0]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    selectFile(e.dataTransfer.files?.[0]);
  };

  const selectFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Seules les photos sont acceptées.');
      return;
    }

    try {
      // Create preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setSelectedFile(file);
    } catch (err) {
      console.error('Error selecting file:', err);
      toast.error('Erreur lors de la sélection de la photo.');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !eventId) return;

    setIsUploading(true);

    // 0. Compress Image first
    let compressedFile: File;
    try {
      const options = {
        maxSizeMB: 5,
        maxWidthOrHeight: 3840,
        useWebWorker: true
      };
      compressedFile = await imageCompression(selectedFile, options);
    } catch (compressionErr) {
      console.error('Compression failed:', compressionErr);
      toast.error('Erreur de compression.');
      setIsUploading(false);
      return;
    }

    // 1. Check connectivity
    if (!isOnline) {
      const fileName = `${eventId}/${uuidv4()}.${compressedFile.name.split('.').pop()}`;
      await addToQueue(compressedFile, eventId, fileName);
      setPreview(null);
      setSelectedFile(null);
      setIsUploading(false);
      return;
    }

    // 2. Try Online Upload
    try {
      const fileName = `${eventId}/${uuidv4()}.${compressedFile.name.split('.').pop()}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      // Le statut (pending/approved) est fixé par la base selon la modération de l'événement.
      const { error: dbError } = await supabase
        .from('photos')
        .insert({
          event_id: eventId,
          storage_path: fileName,
        });

      if (dbError) throw dbError;

      if (moderationEnabled) {
        toast.success('Photo envoyée ! En attente de validation.');
      } else {
        toast.success('Photo envoyée !');
      }

      setPreview(null);
      setSelectedFile(null);
      onUploadComplete();

    } catch (err) {
      console.error('Upload failed:', err);
      const message = err instanceof Error ? err.message : String(err);

      if (isNetworkError(message)) {
        // Réseau coupé : on garde la photo pour la renvoyer plus tard.
        const fileName = `${eventId}/${uuidv4()}.${compressedFile.name.split('.').pop()}`;
        await addToQueue(compressedFile, eventId, fileName);
        setPreview(null);
        setSelectedFile(null);
      } else {
        // Refus du serveur (limite atteinte, galerie fermée, fichier invalide) : inutile de réessayer.
        toast.error(uploadRefusalMessage(message));
      }
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setPreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="uploader-container">
      {/* Offline Status */}
      {queueLength > 0 && (
        <div className="offline-badge">
          <WifiOff size={14} />
          {queueLength} en attente
        </div>
      )}

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        style={{ display: 'none' }}
      />

      {preview ? (
        <div className="preview-container">
          <img src={preview} alt="Aperçu" className="preview-image" />

          <button
            onClick={clearSelection}
            className="preview-close-btn"
          >
            <X size={20} color="#333" />
          </button>

          <div className="preview-actions">
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="action-btn"
            >
              {isUploading ? <Loader2 className="animate-spin" style={{ display: 'inline' }} /> : (isOnline ? 'Envoyer la Photo' : 'Sauvegarder (Hors-ligne)')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Primary Action Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="action-btn btn-secondary"
          >
            <Camera size={20} color="#D4AF37" />
            Prendre ou Choisir une Photo
          </button>

          {/* Dropzone Visual Hint */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            className="upload-area"
            style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem' }}
          >
            Glissez-déposez vos photos ici
          </div>
        </>
      )}
    </div>
  );
}