'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody } from '@/components/ui';
import { RESERVATION_TTL_MS } from '@/lib/listings/constants';

interface ReservationCountdownProps {
  reservedAt: string;
  /** When true, shows buyer-facing "Reserved for you" copy instead of "reserved by another buyer". */
  isOwner?: boolean;
  /** When true, renders inline text without Card wrapper (for embedding in other cards). */
  compact?: boolean;
}

export function ReservationCountdown({ reservedAt, isOwner = false, compact = false }: ReservationCountdownProps) {
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
        {isOwner ? 'Reservation expired. Refreshing...' : 'Checking availability...'}
      </p>
    );
  }

  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

  const content = isOwner ? (
    <p className="text-sm text-semantic-text-secondary">
      Reserved for you — <span className="font-medium text-semantic-text-primary">{timeStr}</span> remaining
    </p>
  ) : (
    <>
      <p className="text-sm text-semantic-text-secondary">
        This game is currently reserved by another buyer.
      </p>
      <p className="text-sm text-semantic-text-muted mt-1">
        Available in <span className="font-medium text-semantic-text-primary">{timeStr}</span>
      </p>
    </>
  );

  if (compact) {
    return content;
  }

  return (
    <Card>
      <CardBody>
        {content}
      </CardBody>
    </Card>
  );
}
