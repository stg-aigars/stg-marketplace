'use client';

import { useState } from 'react';
import { Tag, Gavel, Storefront } from '@phosphor-icons/react/ssr';
import { Card, CardBody, Button } from '@/components/ui';
import { ListingCreationFlow } from './ListingCreationFlow';
import { SellStepHeader } from './SellStepHeader';
import type { ListingType } from '@/lib/listings/types';

export function SellPageClient() {
  const [listingType, setListingType] = useState<ListingType | null>(null);

  if (!listingType) {
    return (
      <Card>
        <CardBody className="space-y-6 px-4 py-6 sm:px-6 sm:py-8">
          <SellStepHeader
            variant="icon"
            title="Two ways to sell"
            helper="Pick what fits this game. Your next listing can be different."
            icon={<Storefront size={24} weight="duotone" />}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
            <div className="space-y-2">
              <Button
                variant="brand"
                size="md"
                onClick={() => setListingType('fixed_price')}
                className="w-full text-base"
              >
                <Tag size={20} weight="bold" className="mr-2" />
                Fixed price
              </Button>
              <p className="text-sm text-semantic-text-muted">
                Set a price. First buyer wins.
              </p>
            </div>

            <div className="space-y-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setListingType('auction')}
                className="w-full text-base"
              >
                <Gavel size={20} weight="bold" className="mr-2" />
                Auction
              </Button>
              <p className="text-sm text-semantic-text-muted">
                Start low. Watch buyers bid it up over a few days.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
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
