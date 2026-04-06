'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash } from '@phosphor-icons/react/ssr';

interface DeleteItemButtonProps {
  onDelete: () => Promise<{ success: true } | { error: string }>;
  title?: string;
}

export type { DeleteItemButtonProps };

export function DeleteItemButton({ onDelete, title = 'Remove' }: DeleteItemButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setDeleting(true);
    setError(false);
    const result = await onDelete();
    if ('error' in result) {
      setDeleting(false);
      setError(true);
    } else {
      router.refresh();
    }
  };

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-semantic-error sm:hover:underline font-medium"
        >
          {deleting ? 'Removing...' : error ? 'Retry' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="text-semantic-text-muted sm:hover:underline"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-semantic-text-muted sm:hover:text-semantic-error transition-colors duration-250 ease-out-custom"
      title={title}
    >
      <Trash size={14} />
    </button>
  );
}
