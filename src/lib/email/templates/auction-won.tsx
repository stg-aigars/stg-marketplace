import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { EmailLayout, templateStyles } from './layout';

interface AuctionWonProps {
  winnerName: string;
  gameName: string;
  winningBidCents: number;
  checkoutUrl: string;
}

export function AuctionWon({
  winnerName, gameName, winningBidCents, checkoutUrl,
}: AuctionWonProps) {
  return (
    <EmailLayout preview={`You won ${gameName} — pay within 24 hours`}>
      <Text style={templateStyles.greeting}>Hi {winnerName},</Text>
      <Text style={templateStyles.body}>
        You won the auction for <strong>{gameName}</strong> with a bid of{' '}
        <strong>{formatCentsToCurrency(winningBidCents)}</strong>. Complete your payment within
        24 hours to secure this game.
      </Text>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody><tr><td style={templateStyles.ctaSection}>
          <Link href={checkoutUrl} style={templateStyles.ctaFrost}>Pay now</Link>
        </td></tr></tbody>
      </table>
      <Text style={templateStyles.note}>
        If payment is not completed within 24 hours, the auction will be cancelled.
      </Text>
    </EmailLayout>
  );
}
