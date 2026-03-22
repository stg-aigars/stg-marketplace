'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Warning } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  message?: string;
}

export function ErrorFallback({
  error,
  reset,
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
}: ErrorFallbackProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="text-center py-16">
        <Warning size={64} className="mx-auto text-semantic-text-muted mb-4" />
        <h1 className="text-2xl font-bold text-semantic-text-heading mb-2">
          {title}
        </h1>
        <p className="text-semantic-text-secondary mb-6">{message}</p>
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
