'use client';

import { useState } from 'react';
import { Button, Card, CardBody } from '@/components/ui';
import { MakeWantedOfferModal } from '@/components/wanted/MakeWantedOfferModal';
import type { ListingCondition } from '@/lib/listings/types';

interface WantedDetailActionsProps {
  wantedListingId: string;
  gameName: string;
  minCondition: ListingCondition;
  maxPriceCents: number | null;
}

export function WantedDetailActions({
  wantedListingId,
  gameName,
  minCondition,
  maxPriceCents,
}: WantedDetailActionsProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Card className="mt-6">
        <CardBody className="text-center">
          <p className="text-sm text-semantic-text-muted mb-3">
            Have this game? Make an offer to the buyer.
          </p>
          <Button onClick={() => setShowModal(true)}>
            Make an offer
          </Button>
        </CardBody>
      </Card>

      <MakeWantedOfferModal
        open={showModal}
        onClose={() => setShowModal(false)}
        wantedListingId={wantedListingId}
        gameName={gameName}
        minCondition={minCondition}
        maxPriceCents={maxPriceCents}
      />
    </>
  );
}
