'use client';

import { ErrorFallback } from '@/components/errors/ErrorFallback';

export default function OrdersError({
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
      message="We couldn't load your order. Please try again."
    />
  );
}
