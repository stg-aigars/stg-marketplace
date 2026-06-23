'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { RemoveListingModal } from '@/components/listings/RemoveListingModal';
import { ConvertToDecliningModal } from '@/components/listings/ConvertToDecliningModal';
import { isAuctionWithBids, type ListingStatus, type ListingType } from '@/lib/listings/types';

interface OwnerActionsProps {
  listingId: string;
  status: ListingStatus;
  listingType: ListingType;
  bidCount: number;
  priceCents: number;
  locale: string;
}

export function OwnerActions({ listingId, status, listingType, bidCount, priceCents, locale }: OwnerActionsProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  if (status === 'sold' || status === 'cancelled') {
    return null;
  }

  const isReserved = status === 'reserved';
  const hasAuctionBids = isAuctionWithBids(listingType, bidCount);
  const editDisabled = isReserved || hasAuctionBids;
  const canConvertToDeclining = status === 'active' && listingType === 'fixed_price';

  return (
    <>
      <div className="flex gap-3">
        {editDisabled ? (
          <Button variant="secondary" disabled>
            Edit listing
          </Button>
        ) : (
          <Button variant="secondary" asChild>
            <Link href={`/${locale}/listings/${listingId}/edit`}>
              Edit listing
            </Link>
          </Button>
        )}
        {canConvertToDeclining && (
          <Button variant="secondary" onClick={() => setShowConvert(true)}>
            Switch to declining price
          </Button>
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

      {canConvertToDeclining && (
        <ConvertToDecliningModal
          listingId={listingId}
          startingPriceCents={priceCents}
          open={showConvert}
          onClose={() => setShowConvert(false)}
        />
      )}
    </>
  );
}
