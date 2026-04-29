'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { trackClient } from '@/lib/analytics';
import type { ListingCondition } from '@/lib/listings/types';

export interface AddToCartListing {
  id: string;
  gameTitle: string;
  gameThumbnail: string | null;
  priceCents: number;
  sellerCountry: string;
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string | null;
  condition: ListingCondition;
  expansionCount?: number;
}

export function useAddToCart(listing: AddToCartListing) {
  const router = useRouter();
  const { addItem, isInCart } = useCart();

  function addToCart() {
    if (!isInCart(listing.id)) {
      addItem({
        listingId: listing.id,
        gameTitle: listing.gameTitle,
        gameThumbnail: listing.gameThumbnail,
        priceCents: listing.priceCents,
        sellerCountry: listing.sellerCountry,
        sellerId: listing.sellerId,
        sellerName: listing.sellerName,
        sellerAvatarUrl: listing.sellerAvatarUrl,
        condition: listing.condition,
        addedAt: new Date().toISOString(),
        ...(listing.expansionCount ? { expansionCount: listing.expansionCount } : {}),
      });
      trackClient('cart_item_added', {
        listing_id: listing.id,
        price_cents: listing.priceCents,
        seller_id: listing.sellerId,
      });
    }
    router.push('/cart');
  }

  return { addToCart };
}
