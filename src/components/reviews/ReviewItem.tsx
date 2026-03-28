import { ThumbsUp, ThumbsDown } from '@phosphor-icons/react/ssr';
import { formatDate } from '@/lib/date-utils';
import type { ReviewWithReviewer, ReviewRow } from '@/lib/reviews/types';

interface ReviewItemProps {
  review: ReviewWithReviewer | ReviewRow;
  /** Override reviewer name (e.g. "You" for the submitter) */
  reviewerName?: string;
}

function getReviewerName(review: ReviewWithReviewer | ReviewRow, override?: string): string {
  if (override) return override;
  if ('reviewer_profile' in review && review.reviewer_profile?.full_name) {
    return review.reviewer_profile.full_name;
  }
  return 'Anonymous';
}

export function ReviewItem({ review, reviewerName }: ReviewItemProps) {
  const name = getReviewerName(review, reviewerName);

  return (
    <div className="flex gap-3 py-3">
      {/* Thumb icon */}
      <div className={`shrink-0 mt-0.5 ${review.is_positive ? 'text-semantic-brand' : 'text-semantic-text-muted'}`}>
        {review.is_positive ? (
          <ThumbsUp size={20} weight="fill" />
        ) : (
          <ThumbsDown size={20} weight="fill" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-semantic-text-primary">{name}</span>
          <span className="text-semantic-text-muted">
            {formatDate(new Date(review.created_at))}
          </span>
        </div>
        {review.comment && (
          <p className="mt-1 text-sm text-semantic-text-secondary">{review.comment}</p>
        )}
      </div>
    </div>
  );
}
