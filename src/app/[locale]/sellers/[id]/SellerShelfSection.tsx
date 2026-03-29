'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { isBggImage } from '@/lib/bgg/utils';
import { Button, Badge, Card } from '@/components/ui';
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

  // Hide not_for_sale items from public view
  const visibleItems = items.filter((i) => i.visibility !== 'not_for_sale');
  if (visibleItems.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading mb-4">
        Game shelf ({visibleItems.length})
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {visibleItems.map((item) => {
          const thumbnail = item.thumbnail;
          const isGeekdo = isBggImage(thumbnail);
          const canOffer =
            item.visibility === 'open_to_offers' &&
            currentUserId !== null &&
            currentUserId !== sellerId;
          const isListed = item.visibility === 'listed' && item.listing_id;

          return (
            <Card key={item.id} className="overflow-hidden">
              <div className="aspect-square bg-semantic-bg-subtle flex items-center justify-center overflow-hidden relative">
                {thumbnail ? (
                  <Image
                    src={thumbnail}
                    alt={item.game_name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
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
                  <Link
                    href={`/listings/${item.listing_id}`}
                    className="block w-full text-center text-sm font-medium py-1.5 rounded-lg text-semantic-text-secondary hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
                  >
                    View listing
                  </Link>
                )}
              </div>
            </Card>
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
