'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { ErrorFallback } from '@/components/errors/ErrorFallback';
import {
  isStaleActionError,
  isRenderedMoreHooksError,
  hasRecentReloadAttempt,
  markReloadAttempt,
} from '@/lib/stale-action-guard';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isAutoRecoverable = isStaleActionError(error) || isRenderedMoreHooksError(error);
  const shouldReload = isAutoRecoverable && !hasRecentReloadAttempt();

  useEffect(() => {
    if (shouldReload) {
      Sentry.captureException(error);
      markReloadAttempt();
      window.location.reload();
    }
  }, [error, shouldReload]);

  if (shouldReload) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-semantic-text-secondary">Updating...</p>
      </div>
    );
  }

  return <ErrorFallback error={error} reset={reset} />;
}
