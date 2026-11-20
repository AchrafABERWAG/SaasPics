'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  // Mot à recopier pour confirmer une action irréversible (ex: "SUPPRIMER").
  requireText?: string;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

// Fenêtre de confirmation, à la place de window.confirm / window.prompt.
// const [confirm, dialog] = useConfirm();  …  if (await confirm({ title: '…' })) { … }  …  {dialog}
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    []
  );

  const close = useCallback((ok: boolean) => {
    setPending((current) => {
      current?.resolve(ok);
      return null;
    });
  }, []);

  const dialog = pending ? <Dialog key={pending.title} options={pending} onClose={close} /> : null;
  return [confirm, dialog] as const;
}

function Dialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const canConfirm = !options.requireText || typed.trim().toUpperCase() === options.requireText.toUpperCase();

  useEffect(() => {
    (options.requireText ? inputRef.current : confirmRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options.requireText, onClose]);

  return (
    <div className="dialog-overlay" onClick={() => onClose(false)}>
      <div className="dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="dialog-title">{options.title}</h2>
        {options.message && <div className="dialog-message">{options.message}</div>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canConfirm) onClose(true);
          }}
        >
          {options.requireText && (
            <label className="dialog-field">
              Pour confirmer, tapez <strong>{options.requireText}</strong>
              <input ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
          )}
          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={() => onClose(false)}>
              {options.cancelLabel ?? 'Annuler'}
            </button>
            <button ref={confirmRef} type="submit" className={options.danger ? 'btn-danger' : 'btn-sage-primary sm'} disabled={!canConfirm}>
              {options.confirmLabel ?? 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
