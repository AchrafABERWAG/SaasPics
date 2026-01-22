'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, Loader2, X, WifiOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import imageCompression from 'browser-image-compression';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

import { useOfflineQueue } from '@/hooks/useOfflineQueue';

interface PhotoUploaderProps {
  eventId: string;
  onUploadComplete: () => void;
}

export default function PhotoUploader({ eventId, onUploadComplete }: PhotoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addToQueue, isOnline, queueLength } = useOfflineQueue();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
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
      toast.success('Photo ajoutée à la file d\'attente hors ligne !');
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

      const { error: dbError } = await supabase
        .from('photos')
        .insert({
          event_id: eventId,
          storage_path: fileName,
          status: 'pending',
        });

      if (dbError) throw dbError;

      toast.success('Photo envoyée !');
      setPreview(null);
      setSelectedFile(null);
      onUploadComplete();

    } catch (err: any) {
      // Fallback to queue if it looks like a network error
      // Or if user wants us to be resilient
      console.error('Upload failed, trying offline queue:', err);

      const fileName = `${eventId}/${uuidv4()}.${compressedFile.name.split('.').pop()}`;
      await addToQueue(compressedFile, eventId, fileName);
      toast.error('Échec de l\'envoi en ligne. Photo ajoutée à la file d\'attente hors ligne.');
      setPreview(null);
      setSelectedFile(null);
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