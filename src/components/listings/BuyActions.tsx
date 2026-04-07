'use client';

import { ShoppingCart } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';
import { AddToCartButton } from '@/components/listings/AddToCartButton';
import { useBuyNow, type BuyNowListing } from '@/lib/hooks/useBuyNow';

interface BuyActionsProps {
  listing: BuyNowListing;
}

export function BuyActions({ listing }: BuyActionsProps) {
  const { buyNow } = useBuyNow(listing);

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={buyNow}>
        <ShoppingCart size={18} weight="bold" className="mr-1.5" />
        Buy now
      </Button>
      <AddToCartButton listing={listing} />
    </div>
  );
}
