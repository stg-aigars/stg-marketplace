'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { RemoveListingModal } from '@/components/listings/RemoveListingModal';
import type { ListingStatus } from '@/lib/listings/types';

interface OwnerActionsProps {
  listingId: string;
  status: ListingStatus;
  locale: string;
}

export function OwnerActions({ listingId, status, locale }: OwnerActionsProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (status === 'sold' || status === 'cancelled') {
    return null;
  }

  const isReserved = status === 'reserved';

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

      <RemoveListingModal
        listingId={listingId}
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
      />
    </>
  );
}
