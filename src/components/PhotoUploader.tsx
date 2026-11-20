'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, CheckCircle2, ImagePlus, Loader2, WifiOff, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import {
  isNetworkError, loadGuestName, preparePhoto, saveGuestName, sendPreparedPhoto, uploadErrorMessage,
  type PreparedPhoto,
} from '@/lib/upload';

const MAX_PER_BATCH = 30;

type Selected = { key: string; file: File; url: string };
type Phase = 'pick' | 'review' | 'sending' | 'done';

interface PhotoUploaderProps {
  eventId: string;
  galleryHref: string;
  moderationEnabled?: boolean;
  remaining: number | null;              // photos encore autorisées par le pack (null = illimité)
  onUploaded: (count: number) => void;
}

export default function PhotoUploader({ eventId, galleryHref, moderationEnabled = false, remaining, onUploaded }: PhotoUploaderProps) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [selected, setSelected] = useState<Selected[]>([]);
  const [guestName, setGuestName] = useState(loadGuestName);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState({ sent: 0, queued: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);
  const { addToQueue, isOnline, queueLength } = useOfflineQueue();

  // Libère les aperçus en mémoire quand le composant disparaît.
  useEffect(() => () => urlsRef.current.forEach(u => URL.revokeObjectURL(u)), []);

  function clearSelection() {
    selected.forEach(s => URL.revokeObjectURL(s.url));
    urlsRef.current = [];
    setSelected([]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function addFiles(list: FileList | null | undefined) {
    const images = Array.from(list ?? []).filter(f => f.type.startsWith('image/') || /\.(heic|heif|dng)$/i.test(f.name));
    if (images.length === 0) {
      if (list && list.length) toast.error('Seules les photos sont acceptées.');
      return;
    }
    const limit = Math.min(MAX_PER_BATCH, remaining ?? Infinity) - selected.length;
    if (limit <= 0) {
      toast.error(remaining !== null && remaining <= selected.length ? 'La limite de photos de cet événement est atteinte.' : `${MAX_PER_BATCH} photos maximum par envoi.`);
      return;
    }
    const kept = images.slice(0, limit);
    if (kept.length < images.length) {
      toast(remaining !== null && remaining - selected.length < MAX_PER_BATCH
        ? `Seulement ${kept.length} photo${kept.length > 1 ? 's' : ''} ajoutée${kept.length > 1 ? 's' : ''} : limite de l'événement.`
        : `${MAX_PER_BATCH} photos maximum par envoi : envoyez les autres ensuite.`, { icon: 'ℹ️' });
    }
    const added = kept.map(file => {
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      return { key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file, url };
    });
    setSelected(prev => [...prev, ...added]);
    setPhase('review');
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeOne(key: string) {
    setSelected(prev => {
      const item = prev.find(s => s.key === key);
      if (item) URL.revokeObjectURL(item.url);
      const next = prev.filter(s => s.key !== key);
      if (next.length === 0) setPhase('pick');
      return next;
    });
  }

  async function send() {
    if (selected.length === 0) return;
    saveGuestName(guestName);
    const meta = { eventId, guestName, caption };
    const total = selected.length;
    let sent = 0;
    const toQueue: PreparedPhoto[] = [];
    setPhase('sending');
    setProgress({ done: 0, total });

    for (const [index, item] of selected.entries()) {
      let prepared: PreparedPhoto;
      try {
        prepared = await preparePhoto(item.file, meta);
      } catch (err) {
        toast.error(`${item.file.name} : ${uploadErrorMessage(err)}`);
        setProgress({ done: index + 1, total });
        continue;
      }
      if (toQueue.length > 0 || !navigator.onLine) {
        toQueue.push(prepared); // réseau perdu : on garde le reste sur le téléphone
      } else {
        try {
          await sendPreparedPhoto(prepared);
          sent++;
        } catch (err) {
          if (isNetworkError(err)) {
            toQueue.push(prepared);
          } else {
            // Refus du serveur (limite atteinte, galerie fermée…) : inutile d'envoyer les suivantes.
            toast.error(uploadErrorMessage(err));
            break;
          }
        }
      }
      setProgress({ done: index + 1, total });
    }

    if (toQueue.length > 0) await addToQueue(toQueue);
    if (sent > 0) onUploaded(sent);
    clearSelection();
    setCaption('');
    setResult({ sent, queued: toQueue.length });
    setPhase(sent + toQueue.length > 0 ? 'done' : 'pick');
  }

  const fileInput = (
    <input ref={inputRef} type="file" accept="image/*" multiple onChange={e => addFiles(e.target.files)} style={{ display: 'none' }} />
  );

  return (
    <div className="uploader-container">
      {fileInput}
      {queueLength > 0 && (
        <div className="offline-badge"><WifiOff size={14} /> {queueLength} en attente de réseau</div>
      )}

      {phase === 'pick' && (
        <>
          <button type="button" onClick={() => inputRef.current?.click()} className="action-btn btn-secondary">
            <Camera size={20} color="#D4AF37" /> Prendre ou choisir des photos
          </button>
          <div
            className="upload-area desktop-hint"
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          >
            ou glissez-déposez vos photos ici
          </div>
        </>
      )}

      {phase === 'review' && (
        <div className="upload-review">
          <div className="upload-thumbs">
            {selected.map(s => (
              <div key={s.key} className="upload-thumb">
                <img src={s.url} alt="" />
                <button type="button" aria-label="Retirer cette photo" onClick={() => removeOne(s.key)}><X size={14} /></button>
              </div>
            ))}
            {selected.length < Math.min(MAX_PER_BATCH, remaining ?? Infinity) && (
              <button type="button" className="upload-thumb add" onClick={() => inputRef.current?.click()} aria-label="Ajouter des photos">
                <ImagePlus size={22} />
              </button>
            )}
          </div>

          <input className="guest-input" placeholder="Votre prénom (facultatif)" value={guestName}
            onChange={e => setGuestName(e.target.value)} maxLength={40} autoComplete="given-name" />
          <textarea className="guest-input" placeholder="Un petit mot pour les mariés (facultatif)" value={caption}
            onChange={e => setCaption(e.target.value)} maxLength={280} rows={2} />

          <button type="button" className="action-btn" onClick={send}>
            {isOnline ? `Envoyer ${selected.length} photo${selected.length > 1 ? 's' : ''}` : 'Garder pour envoyer plus tard (hors ligne)'}
          </button>
          <button type="button" className="guest-link-button" onClick={() => { clearSelection(); setPhase('pick'); }}>Annuler</button>
        </div>
      )}

      {phase === 'sending' && (
        <div className="upload-progress" role="status">
          <Loader2 className="animate-spin" size={28} />
          <p>Envoi {Math.min(progress.done + 1, progress.total)} / {progress.total}…</p>
          <div className="progress-track"><div style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} /></div>
          <p className="upload-progress-hint">Gardez cette page ouverte jusqu&apos;à la fin.</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="upload-done" role="status">
          <CheckCircle2 size={40} />
          <p className="upload-done-title">
            {result.sent > 0 ? `Merci ! ${result.sent} photo${result.sent > 1 ? 's' : ''} envoyée${result.sent > 1 ? 's' : ''}` : 'Photos gardées sur votre téléphone'}
          </p>
          {result.queued > 0 && <p>{result.queued} photo{result.queued > 1 ? 's partiront' : ' partira'} dès le retour du réseau.</p>}
          {moderationEnabled && result.sent > 0 && <p>Elles apparaîtront après validation par les mariés.</p>}
          {result.sent > 0 && <p className="upload-done-hint">Une erreur ? Vous pouvez supprimer vos photos pendant 10 minutes depuis la galerie.</p>}
          <div className="upload-done-actions">
            <button type="button" className="action-btn" onClick={() => setPhase('pick')}>Envoyer d&apos;autres photos</button>
            <Link href={galleryHref} className="guest-link-button">Voir la galerie</Link>
          </div>
        </div>
      )}
    </div>
  );
}
