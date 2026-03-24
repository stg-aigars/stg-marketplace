'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { Button, Badge } from '@/components/ui';
import type { ShelfItemWithGame } from '@/lib/shelves/types';
import { SHELF_VISIBILITY_LABELS, SHELF_VISIBILITY_BADGE_VARIANT } from '@/lib/shelves/types';
import { MakeOfferModal } from '@/components/offers/MakeOfferModal';

interface SellerShelfSectionProps {
  items: ShelfItemWithGame[];
  sellerId: string;
  currentUserId: string | null;
}

export function SellerShelfSection({ items, sellerId, currentUserId }: SellerShelfSectionProps) {
  const [offerItem, setOfferItem] = useState<ShelfItemWithGame | null>(null);

  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading mb-4">
        Game shelf ({items.length})
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => {
          const thumbnail = item.thumbnail;
          const isGeekdo = thumbnail?.includes('cf.geekdo-images.com');
          const canOffer =
            item.visibility === 'open_to_offers' &&
            currentUserId !== null &&
            currentUserId !== sellerId;
          const isListed = item.visibility === 'listed' && item.listing_id;

          return (
            <div
              key={item.id}
              className="rounded-lg border border-semantic-border-default bg-semantic-bg-elevated overflow-hidden shadow-sm"
            >
              {/* Thumbnail */}
              <div className="h-32 sm:h-36 bg-semantic-bg-subtle flex items-center justify-center overflow-hidden">
                {thumbnail ? (
                  <Image
                    src={thumbnail}
                    alt={item.game_name}
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                    unoptimized={!!isGeekdo}
                  />
                ) : (
                  <ImageSquare size={48} className="text-semantic-text-muted" />
                )}
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <div>
                  <p className="font-medium text-semantic-text-primary line-clamp-2 text-sm">
                    {item.game_name}
                  </p>
                  {item.game_year && (
                    <p className="text-xs text-semantic-text-muted mt-0.5">
                      {item.game_year}
                    </p>
                  )}
                </div>

                <Badge variant={SHELF_VISIBILITY_BADGE_VARIANT[item.visibility]}>
                  {SHELF_VISIBILITY_LABELS[item.visibility]}
                </Badge>

                {/* Action buttons */}
                {canOffer && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setOfferItem(item)}
                    className="w-full"
                  >
                    Make an offer
                  </Button>
                )}
                {isListed && (
                  <Link href={`/listings/${item.listing_id}`}>
                    <Button size="sm" variant="ghost" className="w-full">
                      View listing
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Make offer modal */}
      {offerItem && (
        <MakeOfferModal
          open={!!offerItem}
          onClose={() => setOfferItem(null)}
          item={offerItem}
        />
      )}
    </section>
  );
}
