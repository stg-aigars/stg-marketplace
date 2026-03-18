'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { Alert } from '@/components/ui';
import { REVIEW_MAX_COMMENT_LENGTH } from '@/lib/reviews/constants';
import type { ReviewRow } from '@/lib/reviews/types';
import { ReviewItem } from './ReviewItem';

interface ReviewFormProps {
  orderId: string;
  sellerId: string;
  sellerName: string;
}

export function ReviewForm({ orderId, sellerId, sellerName }: ReviewFormProps) {
  const [isPositive, setIsPositive] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedReview, setSubmittedReview] = useState<ReviewRow | null>(null);

  if (submittedReview) {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          Your review has been submitted. Thank you for helping the community.
        </Alert>
        <ReviewItem
          review={submittedReview}
          reviewerName="You"
        />
      </div>
    );
  }

  async function handleSubmit() {
    if (isPositive === null) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId,
          isPositive,
          comment: comment.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit review');
        return;
      }

      setSubmittedReview(data.review);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-semantic-text-primary">
        How was your experience with {sellerName}?
      </h2>

      {/* Thumb buttons */}
      <div className="flex gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsPositive(true)}
          className={`flex items-center gap-2 ${
            isPositive === true
              ? 'border-2 border-semantic-success bg-semantic-success/10'
              : 'border border-semantic-border-default'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M7.493 18.5c-.425 0-.82-.236-.975-.632A7.48 7.48 0 0 1 6 15.125c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V3a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23h-.777ZM2.331 10.727a.75.75 0 0 1 .874-.612 49.043 49.043 0 0 1 3.566.773c.294.07.47.37.404.664a49.019 49.019 0 0 1-.773 3.566.75.75 0 0 1-1.486-.212c.173-1.213.31-2.43.41-3.65a48.944 48.944 0 0 0-2.995-.477.75.75 0 0 1-.612-.874v-.868Z" />
          </svg>
          Positive
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsPositive(false)}
          className={`flex items-center gap-2 ${
            isPositive === false
              ? 'border-2 border-semantic-error bg-semantic-error/10'
              : 'border border-semantic-border-default'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M15.73 5.5h1.035A7.984 7.984 0 0 1 18 9.625c0 1.75-.599 3.358-1.602 4.634-.151.192-.373.309-.6.397-.473.183-.89.514-1.212.924a9.042 9.042 0 0 1-2.861 2.4c-.723.384-1.35.956-1.653 1.715a4.498 4.498 0 0 0-.322 1.672V21a.75.75 0 0 1-.75.75 2.25 2.25 0 0 1-2.25-2.25c0-1.152.26-2.243.723-3.218.266-.558-.107-1.282-.725-1.282H5.622c-1.026 0-1.945-.694-2.054-1.715A12.134 12.134 0 0 1 3.5 12.125c0-2.27.631-4.392 1.73-6.205.388-.642.987-.92 1.605-.92h1.868c.483 0 .964.078 1.423.23l3.114 1.04a4.501 4.501 0 0 0 1.423.23h.777ZM21.669 13.773a.75.75 0 0 1-.874.612 49.048 49.048 0 0 1-3.566-.773c-.294-.07-.47-.37-.404-.664a49.019 49.019 0 0 1 .773-3.566.75.75 0 0 1 1.486.212 47.67 47.67 0 0 0-.41 3.65c1.018.143 2.012.317 2.995.477a.75.75 0 0 1 .612.874v-.822Z" />
          </svg>
          Negative
        </Button>
      </div>

      {/* Comment textarea */}
      {isPositive !== null && (
        <div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={REVIEW_MAX_COMMENT_LENGTH}
            placeholder="Share your experience with other buyers (optional)"
            rows={3}
            className="w-full rounded-lg border border-semantic-border-default bg-semantic-bg-primary px-3 py-2 text-sm text-semantic-text-primary placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-border-focus resize-none"
          />
          <p className="mt-1 text-xs text-semantic-text-muted text-right">
            {comment.length}/{REVIEW_MAX_COMMENT_LENGTH}
          </p>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {isPositive !== null && (
        <Button
          variant="primary"
          size="md"
          loading={submitting}
          onClick={handleSubmit}
        >
          Submit review
        </Button>
      )}
    </div>
  );
}
