'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RESERVATION_TTL_MS } from '@/lib/listings/constants';

interface ReservationCountdownProps {
  reservedAt: string;
}

export function ReservationCountdown({ reservedAt }: ReservationCountdownProps) {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState(() => {
    const expiresAt = new Date(reservedAt).getTime() + RESERVATION_TTL_MS;
    return Math.max(0, expiresAt - Date.now());
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const expiresAt = new Date(reservedAt).getTime() + RESERVATION_TTL_MS;
      const remaining = Math.max(0, expiresAt - Date.now());
      setRemainingMs(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        router.refresh();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservedAt, router]);

  if (remainingMs <= 0) {
    return (
      <p className="text-sm text-semantic-text-muted">
        Checking availability...
      </p>
    );
  }

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="rounded-lg border border-semantic-border-default bg-semantic-bg-subtle p-4">
      <p className="text-sm text-semantic-text-secondary">
        This game is currently reserved by another buyer.
      </p>
      <p className="text-sm text-semantic-text-muted mt-1">
        Available in <span className="font-medium text-semantic-text-primary">{timeStr}</span>
      </p>
    </div>
  );
}
