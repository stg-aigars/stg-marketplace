import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface AuctionPaymentExpiredProps {
  recipientName: string;
  gameName: string;
  isSeller: boolean;
  listingsUrl: string;
}

export function AuctionPaymentExpired({
  recipientName, gameName, isSeller, listingsUrl,
}: AuctionPaymentExpiredProps) {
  return (
    <EmailLayout preview={`Auction payment expired for ${gameName}`}>
      <Text style={templateStyles.greeting}>Hi {recipientName},</Text>
      <Text style={templateStyles.body}>
        {isSeller
          ? `The winning bidder did not complete payment for ${gameName} within the deadline. The auction has been cancelled. You can relist the game at any time.`
          : `The payment deadline for ${gameName} has passed and the auction has been cancelled.`}
      </Text>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody><tr><td style={templateStyles.ctaSection}>
          <Link href={listingsUrl} style={templateStyles.ctaFrost}>
            {isSeller ? 'View your listings' : 'Browse games'}
          </Link>
        </td></tr></tbody>
      </table>
    </EmailLayout>
  );
}
