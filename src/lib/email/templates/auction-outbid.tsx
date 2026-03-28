import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { EmailLayout, templateStyles } from './layout';

interface AuctionOutbidProps {
  bidderName: string;
  gameName: string;
  currentBidCents: number;
  listingUrl: string;
}

export function AuctionOutbid({
  bidderName, gameName, currentBidCents, listingUrl,
}: AuctionOutbidProps) {
  return (
    <EmailLayout preview={`You have been outbid on ${gameName}`}>
      <Text style={templateStyles.greeting}>Hi {bidderName},</Text>
      <Text style={templateStyles.body}>
        Someone placed a higher bid on <strong>{gameName}</strong>. The current bid is now{' '}
        <strong>{formatCentsToCurrency(currentBidCents)}</strong>.
      </Text>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody><tr><td style={templateStyles.ctaSection}>
          <Link href={listingUrl} style={templateStyles.ctaFrost}>Place a higher bid</Link>
        </td></tr></tbody>
      </table>
    </EmailLayout>
  );
}
