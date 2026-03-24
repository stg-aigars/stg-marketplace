'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Modal } from '@/components/ui';
import { TurnstileWidget } from '@/components/ui/TurnstileWidget';
import { cancelListing } from '@/lib/listings/actions';
import type { ListingStatus } from '@/lib/listings/types';

interface OwnerActionsProps {
  listingId: string;
  status: ListingStatus;
  locale: string;
}

export function OwnerActions({ listingId, status, locale }: OwnerActionsProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  if (status === 'sold' || status === 'cancelled') {
    return null;
  }

  const isReserved = status === 'reserved';

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);

    const result = await cancelListing(listingId, turnstileToken ?? undefined);

    if ('error' in result) {
      setError(result.error);
      setRemoving(false);
      return;
    }

    setShowConfirm(false);
    router.refresh();
  };

  return (
    <>
      <div className="flex gap-3">
        <Link href={`/${locale}/listings/${listingId}/edit`}>
          <Button variant="secondary" disabled={isReserved}>
            Edit listing
          </Button>
        </Link>
        <Button
          variant="danger"
          disabled={isReserved}
          onClick={() => setShowConfirm(true)}
        >
          Remove listing
        </Button>
      </div>
      {isReserved && (
        <p className="text-sm text-semantic-text-muted mt-2">
          This listing has an active reservation
        </p>
      )}

      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Remove listing"
      >
        <div className="space-y-4">
          <p className="text-semantic-text-secondary">
            This will remove your listing from the marketplace. This action cannot be undone.
          </p>

          {error && (
            <Alert variant="error">{error}</Alert>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowConfirm(false)}
              disabled={removing}
            >
              Keep listing
            </Button>
            <Button
              variant="danger"
              onClick={handleRemove}
              disabled={removing}
            >
              {removing ? 'Removing...' : 'Remove'}
            </Button>
          </div>

          <TurnstileWidget onVerify={setTurnstileToken} />
        </div>
      </Modal>
    </>
  );
}
