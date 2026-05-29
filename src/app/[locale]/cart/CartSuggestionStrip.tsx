'use client';

import { useEffect, useRef } from 'react';
import { ListingCardMini } from '@/components/listings/ListingCardMini';
import { trackClient } from '@/lib/analytics';
import type { CartSuggestion } from '@/lib/checkout/cart-types';

interface CartSuggestionStripProps {
  sellerId: string;
  sellerName: string;
  suggestions: CartSuggestion[];
  showShippingHint: boolean;
}

export function CartSuggestionStrip({
  sellerId,
  sellerName,
  suggestions,
  showShippingHint,
}: CartSuggestionStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const impressionFiredRef = useRef(false);

  // Fire impression event once when the strip becomes ≥50% visible.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || impressionFiredRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !impressionFiredRef.current) {
            impressionFiredRef.current = true;
            trackClient('cart_suggestion_viewed', {
              seller_id: sellerId,
              count: suggestions.length,
            });
            observer.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [sellerId, suggestions.length]);

  if (suggestions.length === 0) return null;

  return (
    <div ref={containerRef} className="mt-4 pt-3">
      <p className="text-sm text-semantic-text-secondary mb-1">
        More from {sellerName}
      </p>
      {showShippingHint && (
        <p className="text-xs text-semantic-text-muted mb-3">
          Shipping is usually included when sellers ship together.
        </p>
      )}
      <ul
        role="list"
        aria-label={`More from ${sellerName}`}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-1 px-1 pb-2"
      >
        {suggestions.map((s, position) => (
          <li
            key={s.listingId}
            className="snap-start shrink-0 w-[160px] sm:w-[180px]"
            onClickCapture={() => {
              trackClient(
                'cart_suggestion_clicked',
                { seller_id: sellerId, listing_id: s.listingId, position },
                { sendInstantly: true },
              );
            }}
          >
            <ListingCardMini
              id={s.listingId}
              gameTitle={s.gameTitle}
              gameThumbnail={s.gameThumbnail}
              firstPhoto={s.firstPhoto}
              condition={s.condition}
              priceCents={s.priceCents}
              expansionCount={s.expansionCount}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
