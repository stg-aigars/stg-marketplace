import { ChatCircleDots } from '@phosphor-icons/react/ssr';
import { Avatar, Badge } from '@/components/ui';
import { formatDate } from '@/lib/date-utils';
import { DeleteCommentButton } from './DeleteCommentButton';
import type { ListingComment } from '@/lib/comments/types';

interface CommentListProps {
  comments: ListingComment[];
  isStaff: boolean;
}

export function CommentList({ comments, isStaff }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="text-center py-8">
        <ChatCircleDots size={40} className="mx-auto text-semantic-text-muted mb-2" />
        <p className="text-sm text-semantic-text-muted">
          No comments yet. Ask the seller a question
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="rounded-lg border border-semantic-border-subtle p-3"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Avatar name={comment.author_name ?? '?'} size="sm" />
            <span className="text-sm font-medium text-semantic-text-heading truncate">
              {comment.author_name ?? '[deleted]'}
            </span>
            {comment.author_is_seller && (
              <Badge variant="trust">Seller</Badge>
            )}
            <span className="text-xs text-semantic-text-muted ml-auto flex-shrink-0">
              {formatDate(comment.created_at)}
            </span>
            {isStaff && (
              <DeleteCommentButton commentId={comment.id} />
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
