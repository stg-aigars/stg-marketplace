'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Textarea } from '@/components/ui';
import { postComment } from '@/lib/comments/actions';
import { MAX_COMMENT_LENGTH } from '@/lib/comments/types';

interface CommentFormProps {
  listingId: string;
}

export function CommentForm({ listingId }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);

    const result = await postComment(listingId, trimmed);
    if ('error' in result) {
      setError(result.error);
      setSubmitting(false);
    } else {
      setContent('');
      setSubmitting(false);
      router.refresh();
    }
  };

  const charCount = content.length;

  return (
    <form onSubmit={handleSubmit}>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setIsActive(true)}
        placeholder="Ask a question or leave a comment..."
        maxLength={MAX_COMMENT_LENGTH}
        rows={2}
      />
      {isActive && (
        <>
          {error && (
            <p className="mt-1 text-sm text-semantic-error">{error}</p>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-semantic-text-muted">
              {charCount > 0 && `${charCount}/${MAX_COMMENT_LENGTH}`}
            </span>
            <Button type="submit" size="sm" disabled={!content.trim() || submitting}>
              {submitting ? 'Posting...' : 'Post comment'}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
