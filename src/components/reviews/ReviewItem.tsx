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
      <div className={`shrink-0 mt-0.5 ${review.is_positive ? 'text-semantic-success' : 'text-semantic-error'}`}>
        {review.is_positive ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 1 1-2.5 0v-7.5ZM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0 1 14 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 0 1-1.341 5.974 1.457 1.457 0 0 1-1.456 1.029H8.25a.75.75 0 0 1-.75-.75v-7a.75.75 0 0 1 .127-.416 24.11 24.11 0 0 0 3.373-8.084Z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M18.905 12.75a1.25 1.25 0 0 1-2.5 0v-7.5a1.25 1.25 0 0 1 2.5 0v7.5ZM8.905 17v1.3c0 .268-.14.526-.395.607A2 2 0 0 1 5.905 17c0-.995.182-1.948.514-2.826.204-.54-.166-1.174-.744-1.174h-2.52c-1.242 0-2.26-1.01-2.146-2.247.193-2.08.652-4.082 1.341-5.974A1.457 1.457 0 0 1 3.805 3.75h8.693a.75.75 0 0 1 .75.75v7a.75.75 0 0 1-.128.416 24.087 24.087 0 0 0-3.373 8.084 1.502 1.502 0 0 1-.942-3Z" />
          </svg>
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
