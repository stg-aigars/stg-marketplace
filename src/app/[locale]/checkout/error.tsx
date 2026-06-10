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

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // /checkout/[listingId] (legacy notification links for auction.won /
  // auction.payment_reminder) redirects to /listings/[id]. A "Rendered more
  // hooks" error during that transition surfaces here rather than in
  // [locale]/error.tsx — apply the same auto-recovery mitigation so it
  // doesn't fall through to a hard "Something went wrong" page.
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

  return (
    <ErrorFallback
      error={error}
      reset={reset}
      message="Something went wrong during checkout. Your payment was not processed."
    />
  );
}
