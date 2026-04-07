'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import type { ListingCondition } from '@/lib/listings/types';

export interface PayAuctionListing {
  id: string;
  gameTitle: string;
  gameThumbnail: string | null;
  currentBidCents: number;
  paymentDeadlineAt: string | null;
  sellerCountry: string;
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl?: string | null;
  condition: ListingCondition;
}

export function usePayAuction(listing: PayAuctionListing) {
  const router = useRouter();
  const { addItem, isInCart } = useCart();

  function payNow() {
    if (!isInCart(listing.id)) {
      addItem({
        listingId: listing.id,
        gameTitle: listing.gameTitle,
        gameThumbnail: listing.gameThumbnail,
        priceCents: listing.currentBidCents,
        sellerCountry: listing.sellerCountry,
        sellerId: listing.sellerId,
        sellerName: listing.sellerName,
        sellerAvatarUrl: listing.sellerAvatarUrl,
        condition: listing.condition,
        addedAt: new Date().toISOString(),
        isAuction: true,
        auctionDeadlineAt: listing.paymentDeadlineAt,
      });
    }
    router.push(`/checkout?seller=${listing.sellerId}`);
  }

  return { payNow };
}
