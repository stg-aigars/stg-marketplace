'use client';

import { useRef, type ReactNode } from 'react';
import { MobileBuyBar } from './MobileBuyBar';
import type { ListingCondition } from '@/lib/listings/types';

interface PurchaseSectionProps {
  children: ReactNode;
  priceCents: number;
  isReservedByMe: boolean;
  showMobileBuyBar: boolean;
  listing: {
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
  };
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
