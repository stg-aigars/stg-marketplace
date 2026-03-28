'use client';

import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { X } from '@phosphor-icons/react/ssr';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialog.close();
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [handleClose]);

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-x-0 bottom-0 sm:inset-auto sm:fixed sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-lg m-0 sm:m-auto p-0 rounded-t-xl sm:rounded-xl shadow-xl border-0 backdrop:bg-semantic-bg-overlay backdrop:backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="bg-semantic-bg-elevated rounded-t-xl sm:rounded-xl max-h-[85vh] flex flex-col">
        {/* Drag handle - mobile only */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-semantic-border-default" />
        </div>

        {title && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-semantic-border-subtle flex items-center justify-between shrink-0">
            <h2 className="text-lg font-semibold text-semantic-text-heading">{title}</h2>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-semantic-text-muted active:text-semantic-text-primary sm:hover:text-semantic-text-primary transition-colors duration-250 ease-out-custom"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="px-4 sm:px-6 pt-4 overflow-y-auto pb-safe">
          {children}
        </div>
      </div>
    </dialog>
  );
}

export { Modal };
export type { ModalProps };
