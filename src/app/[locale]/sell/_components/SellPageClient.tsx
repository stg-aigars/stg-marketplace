'use client';

import { useState } from 'react';
import { Tag, Gavel } from '@phosphor-icons/react/ssr';
import { Card, CardBody } from '@/components/ui';
import { ListingCreationFlow } from './ListingCreationFlow';
import type { ListingType } from '@/lib/listings/types';

export function SellPageClient() {
  const [listingType, setListingType] = useState<ListingType | null>(null);

  if (!listingType) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-semantic-text-muted">
          How would you like to sell your game?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button type="button" onClick={() => setListingType('fixed_price')}>
            <Card hoverable className="h-full text-left">
              <CardBody className="flex items-start gap-4 py-6">
                <Tag size={32} weight="duotone" className="text-semantic-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-semantic-text-heading">Fixed price</p>
                  <p className="text-sm text-semantic-text-muted mt-1">
                    Set a price and sell to the first buyer. Best for games you want to sell quickly.
                  </p>
                </div>
              </CardBody>
            </Card>
          </button>

          <button type="button" onClick={() => setListingType('auction')}>
            <Card hoverable className="h-full text-left">
              <CardBody className="flex items-start gap-4 py-6">
                <Gavel size={32} weight="duotone" className="text-semantic-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-semantic-text-heading">Auction</p>
                  <p className="text-sm text-semantic-text-muted mt-1">
                    Set a starting price and let buyers bid. Best for rare or sought-after games.
                  </p>
                </div>
              </CardBody>
            </Card>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setListingType(null)}
        className="text-sm text-semantic-text-muted active:text-semantic-primary sm:hover:text-semantic-primary mb-4 inline-block"
      >
        ← Change listing type
      </button>
      <ListingCreationFlow listingType={listingType} />
    </div>
  );
}
