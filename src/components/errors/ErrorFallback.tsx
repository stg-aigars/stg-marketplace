'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
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
        <svg
          className="w-16 h-16 mx-auto text-semantic-text-muted mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
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
