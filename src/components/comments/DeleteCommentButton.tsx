'use client';

import { DeleteItemButton } from '@/components/ui';
import { deleteComment } from '@/lib/comments/actions';

interface DeleteCommentButtonProps {
  commentId: string;
  listingId: string;
}

export function DeleteCommentButton({ commentId, listingId }: DeleteCommentButtonProps) {
  return (
    <DeleteItemButton
      onDelete={() => deleteComment(commentId, listingId)}
      title="Remove comment"
    />
  );
}
