/**
 * Offer Countered Notification — Buyer
 * Sent when the seller counters the buyer's offer with a different price.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { EmailLayout, templateStyles } from './layout';

interface OfferCounteredProps {
  buyerName: string;
  sellerName: string;
  gameName: string;
  originalAmountCents: number;
  counterAmountCents: number;
  offersUrl: string;
}

export function OfferCountered({
  buyerName,
  sellerName,
  gameName,
  originalAmountCents,
  counterAmountCents,
  offersUrl,
}: OfferCounteredProps) {
  return (
    <EmailLayout preview={`${sellerName} countered your offer on ${gameName}`}>
      <Text style={templateStyles.greeting}>Hi {buyerName},</Text>

      <Text style={templateStyles.body}>
        <strong>{sellerName}</strong> countered your offer on{' '}
        <strong>{gameName}</strong>.
      </Text>

      <Text style={templateStyles.body}>
        Your offer: <strong>{formatCentsToCurrency(originalAmountCents)}</strong>
        {'\n'}
        Counter: <strong>{formatCentsToCurrency(counterAmountCents)}</strong>
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
              <Link href={offersUrl} style={templateStyles.ctaFrost}>
                View offer
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>
        You have 7 days to accept or decline this counter-offer.
      </Text>
    </EmailLayout>
  );
}
