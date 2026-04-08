'use client';

import { useRef, type ReactNode } from 'react';
import { MobileBuyBar } from './MobileBuyBar';
import type { AddToCartListing } from '@/lib/hooks/useAddToCart';

interface PurchaseSectionProps {
  children: ReactNode;
  priceCents: number;
  isReservedByMe: boolean;
  showMobileBuyBar: boolean;
  listing: AddToCartListing;
}

export function PurchaseSection({
  children,
  priceCents,
  isReservedByMe,
  showMobileBuyBar,
  listing,
}: PurchaseSectionProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={cardRef}>
      {children}
      {showMobileBuyBar && (
        <MobileBuyBar
          targetRef={cardRef}
          priceCents={priceCents}
          isReservedByMe={isReservedByMe}
          listing={listing}
        />
      )}
    </div>
  );
}
