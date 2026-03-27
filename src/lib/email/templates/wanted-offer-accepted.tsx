/**
 * Wanted Offer Accepted — Both parties
 * Sent when a wanted offer is accepted. Seller must create a listing within 3 days.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { EmailLayout, templateStyles } from './layout';

interface WantedOfferAcceptedProps {
  recipientName: string;
  otherPartyName: string;
  gameName: string;
  agreedPriceCents: number;
  isSeller: boolean;
  actionUrl: string;
}

export function WantedOfferAccepted({
  recipientName,
  otherPartyName,
  gameName,
  agreedPriceCents,
  isSeller,
  actionUrl,
}: WantedOfferAcceptedProps) {
  return (
    <EmailLayout preview={`Offer accepted for ${gameName} at ${formatCentsToCurrency(agreedPriceCents)}`}>
      <Text style={templateStyles.greeting}>Hi {recipientName},</Text>

      <Text style={templateStyles.body}>
        The offer for <strong>{gameName}</strong> at{' '}
        <strong>{formatCentsToCurrency(agreedPriceCents)}</strong> has been accepted.
      </Text>

      {isSeller ? (
        <Text style={templateStyles.body}>
          Please create a listing for this game within 3 days so {otherPartyName} can complete the purchase.
        </Text>
      ) : (
        <Text style={templateStyles.body}>
          {otherPartyName} will create a listing shortly. We will notify you when it is ready to purchase.
        </Text>
      )}

      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={actionUrl} style={templateStyles.ctaFrost}>
                {isSeller ? 'Create listing' : 'View your wanted games'}
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}
