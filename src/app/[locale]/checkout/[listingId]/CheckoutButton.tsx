'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

interface CheckoutButtonProps {
  listingId: string;
}

export function CheckoutButton({ listingId }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      // Redirect to EveryPay payment page
      window.location.href = data.paymentLink;
    } catch {
      setError('Connection error. Please check your internet and try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        variant="primary"
        size="lg"
        loading={loading}
        onClick={handleCheckout}
        className="w-full"
      >
        Pay now
      </Button>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
