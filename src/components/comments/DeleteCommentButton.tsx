'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Trash } from '@phosphor-icons/react/ssr';
import { deleteComment } from '@/lib/comments/actions';

interface DeleteCommentButtonProps {
  commentId: string;
}

export function DeleteCommentButton({ commentId }: DeleteCommentButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    const result = await deleteComment(commentId);
    if ('error' in result) {
      setDeleting(false);
      setConfirming(false);
    } else {
      router.refresh();
    }
  }, [commentId, router]);

  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-xs">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-semantic-error sm:hover:underline font-medium"
        >
          {deleting ? 'Removing...' : 'Confirm'}
        </button>
        <button
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
      onClick={() => setConfirming(true)}
      className="text-semantic-text-muted sm:hover:text-semantic-error transition-colors duration-250 ease-out-custom"
      title="Remove comment"
    >
      <Trash size={14} />
    </button>
  );
}
