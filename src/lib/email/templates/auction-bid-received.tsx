import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { EmailLayout, templateStyles } from './layout';

interface AuctionBidReceivedProps {
  sellerName: string;
  bidderName: string;
  gameName: string;
  bidAmountCents: number;
  bidCount: number;
  listingUrl: string;
}

export function AuctionBidReceived({
  sellerName, bidderName, gameName, bidAmountCents, bidCount, listingUrl,
}: AuctionBidReceivedProps) {
  return (
    <EmailLayout preview={`New bid of ${formatCentsToCurrency(bidAmountCents)} on ${gameName}`}>
      <Text style={templateStyles.greeting}>Hi {sellerName},</Text>
      <Text style={templateStyles.body}>
        <strong>{bidderName}</strong> placed a bid of{' '}
        <strong>{formatCentsToCurrency(bidAmountCents)}</strong> on your auction for{' '}
        <strong>{gameName}</strong>. Total bids: {bidCount}.
      </Text>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody><tr><td style={templateStyles.ctaSection}>
          <Link href={listingUrl} style={templateStyles.ctaFrost}>View auction</Link>
        </td></tr></tbody>
      </table>
    </EmailLayout>
  );
}
