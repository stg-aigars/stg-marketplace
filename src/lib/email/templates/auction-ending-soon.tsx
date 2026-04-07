import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface AuctionEndingSoonProps {
  recipientName: string;
  gameName: string;
  listingUrl: string;
}

export function AuctionEndingSoon({
  recipientName, gameName, listingUrl,
}: AuctionEndingSoonProps) {
  return (
    <EmailLayout preview={`${gameName} auction ends in about 30 minutes`}>
      <Text style={templateStyles.greeting}>Hi {recipientName},</Text>
      <Text style={templateStyles.body}>
        The auction for <strong>{gameName}</strong> ends in about 30 minutes.
        Place your final bids now.
      </Text>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody><tr><td style={templateStyles.ctaSection}>
          <Link href={listingUrl} style={templateStyles.ctaFrost}>View auction</Link>
        </td></tr></tbody>
      </table>
    </EmailLayout>
  );
}
