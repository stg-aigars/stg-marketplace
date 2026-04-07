'use client';

import { useRouter } from 'next/navigation';
import { ShoppingCart } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';
import { AddToCartButton } from '@/components/listings/AddToCartButton';
import { useCart } from '@/contexts/CartContext';
import type { ListingCondition } from '@/lib/listings/types';

interface BuyActionsProps {
  listing: {
    id: string;
    gameTitle: string;
    gameThumbnail: string | null;
    priceCents: number;
    sellerCountry: string;
    sellerId: string;
    condition: ListingCondition;
    expansionCount?: number;
  };
}

export function BuyActions({ listing }: BuyActionsProps) {
  const router = useRouter();
  const { addItem, isInCart } = useCart();

  function handleBuyNow() {
    if (!isInCart(listing.id)) {
      addItem({
        listingId: listing.id,
        gameTitle: listing.gameTitle,
        gameThumbnail: listing.gameThumbnail,
        priceCents: listing.priceCents,
        sellerCountry: listing.sellerCountry,
        sellerId: listing.sellerId,
        condition: listing.condition,
        addedAt: new Date().toISOString(),
        ...(listing.expansionCount ? { expansionCount: listing.expansionCount } : {}),
      });
    }
    router.push('/cart');
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={handleBuyNow}>
        <ShoppingCart size={18} weight="bold" className="mr-1.5" />
        Buy now
      </Button>
      <AddToCartButton listing={listing} />
    </div>
  );
}
