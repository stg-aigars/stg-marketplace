import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface AuctionEndedNoBidsProps {
  sellerName: string;
  gameName: string;
  listingsUrl: string;
}

export function AuctionEndedNoBids({
  sellerName, gameName, listingsUrl,
}: AuctionEndedNoBidsProps) {
  return (
    <EmailLayout preview={`Your auction for ${gameName} ended with no bids`}>
      <Text style={templateStyles.greeting}>Hi {sellerName},</Text>
      <Text style={templateStyles.body}>
        Your auction for <strong>{gameName}</strong> has ended with no bids.
        You can create a new listing with a different starting price or try a fixed-price listing.
      </Text>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody><tr><td style={templateStyles.ctaSection}>
          <Link href={listingsUrl} style={templateStyles.ctaFrost}>View your listings</Link>
        </td></tr></tbody>
      </table>
    </EmailLayout>
  );
}
