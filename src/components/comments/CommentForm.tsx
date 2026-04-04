'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { postComment } from '@/lib/comments/actions';
import { MAX_COMMENT_LENGTH } from '@/lib/comments/types';

interface CommentFormProps {
  listingId: string;
  isAuthenticated: boolean;
}

export function CommentForm({ listingId, isAuthenticated }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const router = useRouter();

  if (!isAuthenticated) {
    return (
      <p className="text-sm text-semantic-text-muted">
        <Link href="/auth/signin" className="text-semantic-brand sm:hover:underline font-medium">
          Sign in
        </Link>
        {' '}to leave a comment
      </p>
    );
  }

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
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Ask a question or leave a comment..."
        maxLength={MAX_COMMENT_LENGTH}
        rows={3}
        className="w-full rounded-lg border border-semantic-border-default px-3 py-2.5 text-base sm:text-sm text-semantic-text-primary bg-semantic-bg-elevated placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-brand/20 focus:border-semantic-brand resize-none"
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
