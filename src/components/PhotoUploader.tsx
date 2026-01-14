'use client';

import { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { Camera } from 'lucide-react';

export default function PhotoUploader({ eventId }: { eventId: string }) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading('Compression & Envoi...');

    try {
      const options = {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(file, options);
      const fileName = `${eventId}/${uuidv4()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      await supabase.from('photos').insert({
        event_id: eventId,
        url: publicUrl,
        guest_name: 'Invité Mobile', 
      });

      toast.success('Envoyé !', { id: toastId });

    } catch (error) {
      console.error(error);
      toast.error('Erreur technique', { id: toastId });
    } finally {
      setIsUploading(false);
      e.target.value = ''; 
    }
  };

  return (
    <div className="fixed bottom-8 inset-x-0 flex justify-center z-50 px-4">
      <label className={`
        bg-black text-white w-full max-w-md py-4 rounded-2xl shadow-2xl 
        flex items-center justify-center gap-3 cursor-pointer transition-transform active:scale-95
        ${isUploading ? 'opacity-70' : ''}
      `}>
        <Camera className="w-6 h-6" />
        <span className="font-bold text-lg">
          {isUploading ? 'Envoi en cours...' : 'Ajouter une photo'}
        </span>
        <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      </label>
    </div>
  );
}