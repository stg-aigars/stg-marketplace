import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { EmailLayout, templateStyles } from './layout';

interface AuctionWonSellerProps {
  sellerName: string;
  gameName: string;
  winningBidCents: number;
  listingUrl: string;
}

export function AuctionWonSeller({
  sellerName, gameName, winningBidCents, listingUrl,
}: AuctionWonSellerProps) {
  return (
    <EmailLayout preview={`Your auction for ${gameName} has ended with a winning bid`}>
      <Text style={templateStyles.greeting}>Hi {sellerName},</Text>
      <Text style={templateStyles.body}>
        Your auction for <strong>{gameName}</strong> has ended. The winning bid is{' '}
        <strong>{formatCentsToCurrency(winningBidCents)}</strong>. The buyer has 24 hours to
        complete payment.
      </Text>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody><tr><td style={templateStyles.ctaSection}>
          <Link href={listingUrl} style={templateStyles.ctaFrost}>View listing</Link>
        </td></tr></tbody>
      </table>
    </EmailLayout>
  );
}
