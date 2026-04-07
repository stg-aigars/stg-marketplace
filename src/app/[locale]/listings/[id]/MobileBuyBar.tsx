'use client';

import { useState, useEffect, type RefObject } from 'react';
import Link from 'next/link';
import { ShoppingCart } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { useBuyNow, type BuyNowListing } from '@/lib/hooks/useBuyNow';

interface MobileBuyBarProps {
  targetRef: RefObject<HTMLDivElement | null>;
  priceCents: number;
  isReservedByMe: boolean;
  listing: BuyNowListing;
}

export function MobileBuyBar({ targetRef, priceCents, isReservedByMe, listing }: MobileBuyBarProps) {
  const [visible, setVisible] = useState(false);
  const { buyNow } = useBuyNow(listing);

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
          <Button size="sm" onClick={buyNow}>
            <ShoppingCart size={16} weight="bold" className="mr-1" />
            Buy now
          </Button>
        )}
      </div>
    </div>
  );
}
