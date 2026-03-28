import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface AuctionPaymentReminderProps {
  winnerName: string;
  gameName: string;
  checkoutUrl: string;
}

export function AuctionPaymentReminder({
  winnerName, gameName, checkoutUrl,
}: AuctionPaymentReminderProps) {
  return (
    <EmailLayout preview={`12 hours left to pay for ${gameName}`}>
      <Text style={templateStyles.greeting}>Hi {winnerName},</Text>
      <Text style={templateStyles.body}>
        You have <strong>12 hours left</strong> to complete payment for{' '}
        <strong>{gameName}</strong>. If payment is not completed in time, the auction will be cancelled.
      </Text>
      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody><tr><td style={templateStyles.ctaSection}>
          <Link href={checkoutUrl} style={templateStyles.ctaFrost}>Pay now</Link>
        </td></tr></tbody>
      </table>
    </EmailLayout>
  );
}
