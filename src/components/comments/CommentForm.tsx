'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Textarea, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { postComment } from '@/lib/comments/actions';
import { MAX_COMMENT_LENGTH } from '@/lib/comments/types';

interface CommentFormProps {
  listingId: string;
}

export function CommentForm({ listingId }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);

    const result = await postComment(listingId, trimmed, turnstileToken);
    if ('error' in result) {
      setError(result.error);
      setSubmitting(false);
      turnstileRef.current?.reset();
    } else {
      setContent('');
      setSubmitting(false);
      turnstileRef.current?.reset();
      router.refresh();
    }
  };

  const charCount = content.length;

  return (
    <form onSubmit={handleSubmit}>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Ask a question or leave a comment..."
        maxLength={MAX_COMMENT_LENGTH}
        rows={2}
      />
      <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />
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
    </form>
  );
}
