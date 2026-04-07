'use client';

import { useState, useEffect, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { useCart } from '@/contexts/CartContext';
import type { ListingCondition } from '@/lib/listings/types';

interface MobileBuyBarProps {
  targetRef: RefObject<HTMLDivElement | null>;
  priceCents: number;
  isReservedByMe: boolean;
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

export function MobileBuyBar({ targetRef, priceCents, isReservedByMe, listing }: MobileBuyBarProps) {
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const { addItem, isInCart } = useCart();

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldShow = !entry.isIntersecting;
        setVisible((prev) => (prev === shouldShow ? prev : shouldShow));
      },
      { threshold: 1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRef]);

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
    <div
      className={`fixed bottom-0 inset-x-0 z-40 lg:hidden bg-semantic-bg-elevated border-t border-semantic-border-subtle shadow-md pb-safe px-4 pt-3 transition-transform duration-250 ease-out-custom ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-xl font-bold font-sans tracking-tight text-semantic-text-heading">
          {formatCentsToCurrency(priceCents)}
        </p>
        {isReservedByMe ? (
          <Button size="sm" variant="secondary" asChild>
            <Link href="/account/orders">View your orders</Link>
          </Button>
        ) : (
          <Button size="sm" onClick={handleBuyNow}>
            <ShoppingCart size={16} weight="bold" className="mr-1" />
            Buy now
          </Button>
        )}
      </div>
    </div>
  );
}
