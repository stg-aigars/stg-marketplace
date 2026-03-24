/**
 * Offer Accepted Notification — Either Party
 * Sent to both buyer and seller when an offer is accepted.
 * Content varies based on `isSeller` flag.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { EmailLayout, templateStyles } from './layout';

interface OfferAcceptedProps {
  recipientName: string;
  otherPartyName: string;
  gameName: string;
  agreedAmountCents: number;
  nextStepUrl: string;
  isSeller: boolean;
}

export function OfferAccepted({
  recipientName,
  otherPartyName,
  gameName,
  agreedAmountCents,
  nextStepUrl,
  isSeller,
}: OfferAcceptedProps) {
  return (
    <EmailLayout
      preview={`Offer accepted for ${gameName} at ${formatCentsToCurrency(agreedAmountCents)}`}
    >
      <Text style={templateStyles.greeting}>Hi {recipientName},</Text>

      <Text style={templateStyles.body}>
        <strong>{otherPartyName}</strong> accepted the offer for{' '}
        <strong>{gameName}</strong> at{' '}
        <strong>{formatCentsToCurrency(agreedAmountCents)}</strong>.
      </Text>

      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
      >
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={nextStepUrl} style={templateStyles.ctaFrost}>
                {isSeller ? 'Create listing' : 'View offers'}
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>
        {isSeller
          ? 'Create a listing within 3 days to complete the sale.'
          : "The seller will create a listing shortly. We'll notify you when it's ready."}
      </Text>
    </EmailLayout>
  );
}
