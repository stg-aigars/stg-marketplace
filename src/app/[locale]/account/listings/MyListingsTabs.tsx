'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ListingCard } from '@/components/listings/ListingCard';
import { Badge, Button, Tabs } from '@/components/ui';
import { ListingOverflowMenu } from './ListingOverflowMenu';
import type { MyListingRow } from './page';

interface MyListingsTabsProps {
  active: MyListingRow[];
  inactive: MyListingRow[];
}

const statusLabels: Record<string, string> = {
  sold: 'Sold',
  cancelled: 'Cancelled',
  reserved: 'Reserved',
};

export function MyListingsTabs({ active, inactive }: MyListingsTabsProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');

  const listings = activeTab === 'active' ? active : inactive;

  return (
    <div>
      <Tabs
        tabs={[
          { key: 'active', label: 'Active', count: active.length },
          { key: 'inactive', label: 'Past', count: inactive.length },
        ]}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as 'active' | 'inactive')}
        className="mb-6"
      />

      {/* Listings grid */}
      {listings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-semantic-text-muted">
            {activeTab === 'active'
              ? 'No active listings yet.'
              : 'No past listings.'}
          </p>
          <Link href="/sell" className="inline-block mt-4">
            <Button>List a game</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {listings.map((listing) => (
            <div key={listing.id} className="relative">
              <ListingCard
                id={listing.id}
                gameTitle={listing.game_name}
                gameThumbnail={listing.version_thumbnail ?? listing.games?.image ?? null}
                firstPhoto={listing.photos?.[0] ?? null}
                photoCount={listing.photos?.length ?? 0}
                priceCents={listing.price_cents}
                sellerCountry={listing.country}
                expansionCount={listing.expansion_count}
                commentCount={listing.comment_count}
                isExpansion={listing.games?.is_expansion ?? false}
                isAuction={listing.listing_type === 'auction'}
                bidCount={listing.bid_count}
                auctionEndAt={listing.auction_end_at}
              />
              {listing.status === 'active' && (
                <ListingOverflowMenu
                  listingId={listing.id}
                  listingType={listing.listing_type}
                  bidCount={listing.bid_count}
                />
              )}
              {listing.status !== 'active' && (
                <div className="absolute top-2 right-2">
                  <Badge variant={listing.status === 'sold' ? 'success' : 'default'}>
                    {statusLabels[listing.status] ?? listing.status}
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
