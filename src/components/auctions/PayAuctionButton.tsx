'use client';

import { Button } from '@/components/ui';
import { usePayAuction, type PayAuctionListing } from '@/lib/hooks/usePayAuction';

export function PayAuctionButton({ listing }: { listing: PayAuctionListing }) {
  const { payNow } = usePayAuction(listing);
  return <Button size="sm" onClick={payNow}>Pay now</Button>;
}
