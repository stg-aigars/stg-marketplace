'use client';

import { useState } from 'react';
import { ChatCircleDots } from '@phosphor-icons/react/ssr';
import { Badge, UserIdentity } from '@/components/ui';
import { formatMessageTime } from '@/lib/date-utils';
import { DeleteCommentButton } from './DeleteCommentButton';
import type { ListingComment } from '@/lib/comments/types';

const INITIAL_VISIBLE = 5;

interface CommentListProps {
  comments: ListingComment[];
  isStaff: boolean;
  locale?: string;
}

export function CommentList({ comments, isStaff, locale }: CommentListProps) {
  const [expanded, setExpanded] = useState(false);

  if (comments.length === 0) {
    return (
      <div className="text-center py-6">
        <ChatCircleDots size={36} className="mx-auto text-semantic-text-muted mb-2" />
        <p className="text-sm text-semantic-text-muted">
          No comments yet. Ask the seller a question
        </p>
      </div>
    );
  }

  const hasMore = comments.length > INITIAL_VISIBLE;
  const visible = expanded ? comments : comments.slice(-INITIAL_VISIBLE);

  return (
    <div className="divide-y divide-semantic-border-subtle">
      {hasMore && !expanded && (
        <div className="pb-3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm text-semantic-brand font-medium cursor-pointer"
          >
            Show all {comments.length} comments
          </button>
        </div>
      )}
      {visible.map((comment) => (
        <div key={comment.id} className="py-3 last:pb-0">
          <div className="flex items-center gap-2 mb-1.5">
            <UserIdentity
              name={comment.author_name ?? '[deleted]'}
              avatarUrl={comment.author_avatar_url}
              size="sm"
            >
              {comment.author_is_seller && (
                <Badge variant="trust">Seller</Badge>
              )}
            </UserIdentity>
            <span className="text-xs text-semantic-text-muted ml-auto flex-shrink-0">
              {formatMessageTime(comment.created_at, locale)}
            </span>
            {isStaff && (
              <DeleteCommentButton commentId={comment.id} listingId={comment.listing_id} />
            )}
          </div>
          <p className="text-sm text-semantic-text-secondary whitespace-pre-line pl-8">
            {comment.content}
          </p>
        </div>
      ))}
    </div>
  );
}
