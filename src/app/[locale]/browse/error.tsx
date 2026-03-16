'use client';

import { ErrorFallback } from '@/components/errors/ErrorFallback';

export default function BrowseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      message="We couldn't load the game listings. Please try again."
    />
  );
}
