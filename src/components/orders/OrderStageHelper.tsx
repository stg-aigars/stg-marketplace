'use client';

import { useState } from 'react';
import { MapPin } from '@phosphor-icons/react/ssr';
import { Button, Card, CardBody, InlineArrowLink } from '@/components/ui';
import { CARD_SUBSECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';
import type { OrderStatus } from '@/lib/orders/types';
import type { TerminalOption, TerminalCountry } from '@/lib/services/unisend/types';
import { LockerFinder } from './LockerFinder';
import { BarcodeCard } from './BarcodeCard';

interface OrderStageHelperProps {
  role: 'buyer' | 'seller';
  status: OrderStatus;
  sellerCountry: TerminalCountry;
  terminals: TerminalOption[];
  /** Shipping-label barcode; null until shipping setup succeeds. */
  barcode: string | null;
}

/**
 * Seller-only, stage-specific "next steps" helper. Today only the `accepted`
 * stage has content; other statuses are intentional extension points that
 * render nothing until their content is designed.
 */
export function OrderStageHelper({ role, status, sellerCountry, terminals, barcode }: OrderStageHelperProps) {
  if (role !== 'seller') return null;

  switch (status) {
    case 'accepted':
      return <AcceptedHelper sellerCountry={sellerCountry} terminals={terminals} barcode={barcode} />;
    default:
      return null;
  }
}

function AcceptedHelper({
  sellerCountry,
  terminals,
  barcode,
}: {
  sellerCountry: TerminalCountry;
  terminals: TerminalOption[];
  barcode: string | null;
}) {
  const [showFinder, setShowFinder] = useState(false);

  return (
    // mb-6 lives on the card (not a caller wrapper) so nothing renders empty
    // margin when OrderStageHelper returns null for other roles/statuses.
    // Single shipping hub: lead instruction → barcode → packing → locker finder.
    <Card className="mb-6">
      <CardBody>
        <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS, 'mb-3')}>Ship your parcel</h2>

        <p className="text-sm text-semantic-text-secondary mb-4">
          Drop your parcel at any compatible parcel locker.
        </p>

        {barcode && <BarcodeCard barcode={barcode} className="mb-4" />}

        <p className="text-sm text-semantic-text-secondary">
          First time shipping a game? A bit of padding keeps it safe on the way.{' '}
          <InlineArrowLink href="/help/packing" size="sm">
            Read the packing guide
          </InlineArrowLink>
        </p>

        <div className="mt-4 pt-4 border-t border-semantic-border-subtle">
          {!showFinder ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowFinder(true)}
            >
              <MapPin size={16} className="mr-1.5" aria-hidden="true" />
              Find a drop-off locker
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-semantic-text-secondary">
                Pick whichever locker is closest to you.
              </p>
              <LockerFinder terminals={terminals} country={sellerCountry} />
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
