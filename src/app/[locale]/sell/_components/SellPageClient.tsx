'use client';

import { useState } from 'react';
import { Tag, Gavel, Storefront } from '@phosphor-icons/react/ssr';
import { Card, CardBody } from '@/components/ui';
import { ListingCreationFlow } from './ListingCreationFlow';
import { SellStepHeader } from './SellStepHeader';
import type { ListingType } from '@/lib/listings/types';

export function SellPageClient() {
  const [listingType, setListingType] = useState<ListingType | null>(null);

  if (!listingType) {
    return (
      <div className="space-y-6">
        <SellStepHeader
          variant="icon"
          title="Two ways to sell"
          helper="Pick what fits this game — your next listing can be different."
          icon={<Storefront size={24} weight="duotone" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button type="button" onClick={() => setListingType('fixed_price')}>
            <Card hoverable className="h-full text-left">
              <CardBody className="flex items-start gap-4 py-6">
                <Tag size={32} weight="duotone" className="text-semantic-brand shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-semantic-text-heading">Fixed price</p>
                  <p className="text-sm text-semantic-text-muted mt-1">
                    Set a price. First buyer wins.
                  </p>
                </div>
              </CardBody>
            </Card>
          </button>

          <button type="button" onClick={() => setListingType('auction')}>
            <Card hoverable className="h-full text-left">
              <CardBody className="flex items-start gap-4 py-6">
                <Gavel size={32} weight="duotone" className="text-semantic-brand shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-semantic-text-heading">Auction</p>
                  <p className="text-sm text-semantic-text-muted mt-1">
                    Start low. Watch buyers bid it up over a few days.
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
        className="text-sm text-semantic-text-muted active:text-semantic-brand sm:hover:text-semantic-brand mb-4 inline-block"
      >
        ← Change listing type
      </button>
      <ListingCreationFlow listingType={listingType} />
    </div>
  );
}
