'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThumbsUp, ThumbsDown } from '@phosphor-icons/react';
import { Alert, Button } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { REVIEW_MAX_COMMENT_LENGTH } from '@/lib/reviews/constants';
import type { ReviewRow } from '@/lib/reviews/types';
import { ReviewItem } from './ReviewItem';

interface ReviewFormProps {
  orderId: string;
  sellerId: string;
  sellerName: string;
}

export function ReviewForm({ orderId, sellerId, sellerName }: ReviewFormProps) {
  const router = useRouter();
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
      const res = await apiFetch(`/api/orders/${orderId}/review`, {
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
      router.refresh();
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
          <ThumbsUp size={20} weight="fill" />
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
          <ThumbsDown size={20} weight="fill" />
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
