'use client';

import { ErrorFallback } from '@/components/errors/ErrorFallback';

export default function SellError({
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
      message="Something went wrong while creating your listing. Your progress may be lost."
    />
  );
}
