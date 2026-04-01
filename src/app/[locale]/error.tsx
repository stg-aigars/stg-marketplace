'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/errors/ErrorFallback';
import {
  isStaleActionError,
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
  const isStale = isStaleActionError(error);
  const shouldReload = isStale && !hasRecentReloadAttempt();

  useEffect(() => {
    if (shouldReload) {
      markReloadAttempt();
      window.location.reload();
    }
  }, [shouldReload]);

  if (shouldReload) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-semantic-text-secondary">Updating...</p>
      </div>
    );
  }

  return <ErrorFallback error={error} reset={reset} />;
}
