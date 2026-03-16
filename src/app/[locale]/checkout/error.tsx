'use client';

import { ErrorFallback } from '@/components/errors/ErrorFallback';

export default function CheckoutError({
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
      message="Something went wrong during checkout. Your payment was not processed."
    />
  );
}
