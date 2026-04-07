'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import type { ListingCondition } from '@/lib/listings/types';

export interface BuyNowListing {
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

export function useBuyNow(listing: BuyNowListing) {
  const router = useRouter();
  const { addItem, isInCart } = useCart();

  function buyNow() {
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
    }
    router.push('/cart');
  }

  return { buyNow };
}
