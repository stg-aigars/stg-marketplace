import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface AuctionLostProps {
  bidderName: string;
  gameName: string;
  browseUrl: string;
}

export function AuctionLost({
  bidderName, gameName, browseUrl,
}: AuctionLostProps) {
  return (
    <EmailLayout preview={`The auction for ${gameName} has ended`}>
      <Text style={templateStyles.greeting}>Hi {bidderName},</Text>
      <Text style={templateStyles.body}>
        The auction for <strong>{gameName}</strong> has ended. Unfortunately, your bid was not the
        winning bid.
      </Text>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody><tr><td style={templateStyles.ctaSection}>
          <Link href={browseUrl} style={templateStyles.ctaFrost}>Browse more games</Link>
        </td></tr></tbody>
      </table>
    </EmailLayout>
  );
}
