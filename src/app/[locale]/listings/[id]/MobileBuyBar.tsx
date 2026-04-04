'use client';

import { useState, useEffect, type RefObject } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';

interface MobileBuyBarProps {
  targetRef: RefObject<HTMLDivElement | null>;
  listingId: string;
  priceCents: number;
  isReservedByMe: boolean;
}

export function MobileBuyBar({ targetRef, listingId, priceCents, isReservedByMe }: MobileBuyBarProps) {
  const [visible, setVisible] = useState(false);

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
        <Button size="sm" asChild>
          <Link href={`/checkout/${listingId}`}>
            {isReservedByMe ? 'Complete payment' : 'Buy now'}
          </Link>
        </Button>
      </div>
    </div>
  );
}
