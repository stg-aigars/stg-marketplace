'use client';

import { useRef, type ReactNode } from 'react';
import { MobileBuyBar } from './MobileBuyBar';

interface PurchaseSectionProps {
  children: ReactNode;
  listingId: string;
  priceCents: number;
  isReservedByMe: boolean;
  showMobileBuyBar: boolean;
}

export function PurchaseSection({
  children,
  listingId,
  priceCents,
  isReservedByMe,
  showMobileBuyBar,
}: PurchaseSectionProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={cardRef}>
      {children}
      {showMobileBuyBar && (
        <MobileBuyBar
          targetRef={cardRef}
          listingId={listingId}
          priceCents={priceCents}
          isReservedByMe={isReservedByMe}
        />
      )}
    </div>
  );
}
