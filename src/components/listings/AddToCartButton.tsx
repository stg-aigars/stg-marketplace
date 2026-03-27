'use client';

import { ShoppingCart, Check } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';
import { useCart } from '@/contexts/CartContext';
import type { CartItem } from '@/lib/checkout/cart-types';
import type { ListingCondition } from '@/lib/listings/types';

interface AddToCartButtonProps {
  listing: {
    id: string;
    gameTitle: string;
    gameThumbnail: string | null;
    priceCents: number;
    sellerCountry: string;
    sellerId: string;
    condition: ListingCondition;
  };
}

function AddToCartButton({ listing }: AddToCartButtonProps) {
  const { addItem, removeItem, isInCart, isFull } = useCart();

  const inCart = isInCart(listing.id);

  const handleClick = () => {
    if (inCart) {
      removeItem(listing.id);
    } else {
      const item: CartItem = {
        listingId: listing.id,
        gameTitle: listing.gameTitle,
        gameThumbnail: listing.gameThumbnail,
        priceCents: listing.priceCents,
        sellerCountry: listing.sellerCountry,
        sellerId: listing.sellerId,
        condition: listing.condition,
        addedAt: new Date().toISOString(),
      };
      addItem(item);
    }
  };

  if (isFull && !inCart) {
    return (
      <Button variant="secondary" disabled>
        Cart full (10 items)
      </Button>
    );
  }

  return (
    <Button variant="secondary" onClick={handleClick}>
      <span className="inline-flex items-center gap-1.5">
        {inCart ? <Check size={16} weight="bold" /> : <ShoppingCart size={16} />}
        {inCart ? 'In cart' : 'Add to cart'}
      </span>
    </Button>
  );
}

export { AddToCartButton };
