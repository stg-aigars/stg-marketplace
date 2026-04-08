'use client';

import { ShoppingCart } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';
import { AddToCartButton } from '@/components/listings/AddToCartButton';
import { useAddToCart, type AddToCartListing } from '@/lib/hooks/useAddToCart';

interface BuyActionsProps {
  listing: AddToCartListing;
}

export function BuyActions({ listing }: BuyActionsProps) {
  const { addToCart } = useAddToCart(listing);

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={addToCart}>
        <ShoppingCart size={18} weight="bold" className="mr-1.5" />
        Buy now
      </Button>
      <AddToCartButton listing={listing} />
    </div>
  );
}
