'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { RemoveListingModal } from '@/components/listings/RemoveListingModal';
import type { ListingStatus, ListingType } from '@/lib/listings/types';

interface OwnerActionsProps {
  listingId: string;
  status: ListingStatus;
  listingType: ListingType;
  bidCount: number;
  locale: string;
}

export function OwnerActions({ listingId, status, listingType, bidCount, locale }: OwnerActionsProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (status === 'sold' || status === 'cancelled') {
    return null;
  }

  const isReserved = status === 'reserved';
  const hasAuctionBids = listingType === 'auction' && bidCount > 0;
  const editDisabled = isReserved || hasAuctionBids;

  return (
    <>
      <div className="flex gap-3">
        {editDisabled ? (
          <Button variant="secondary" disabled>
            Edit listing
          </Button>
        ) : (
          <Link href={`/${locale}/listings/${listingId}/edit`}>
            <Button variant="secondary">
              Edit listing
            </Button>
          </Link>
        )}
        <Button
          variant="danger"
          disabled={isReserved || hasAuctionBids}
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
      {hasAuctionBids && (
        <p className="text-sm text-semantic-text-muted mt-2">
          Auctions with bids cannot be edited or removed
        </p>
      )}
      {listingType === 'auction' && bidCount === 0 && (
        <p className="text-sm text-semantic-text-muted mt-2">
          Editing and removing will no longer be available once bids are placed
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
