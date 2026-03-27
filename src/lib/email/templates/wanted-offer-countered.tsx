/**
 * Wanted Offer Countered — Seller
 * Sent when a buyer counters the seller's offer on a wanted listing.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { EmailLayout, templateStyles } from './layout';

interface WantedOfferCounteredProps {
  sellerName: string;
  buyerName: string;
  gameName: string;
  originalPriceCents: number;
  counterPriceCents: number;
  offersUrl: string;
}

export function WantedOfferCountered({
  sellerName,
  buyerName,
  gameName,
  originalPriceCents,
  counterPriceCents,
  offersUrl,
}: WantedOfferCounteredProps) {
  return (
    <EmailLayout preview={`${buyerName} countered your offer for ${gameName}`}>
      <Text style={templateStyles.greeting}>Hi {sellerName},</Text>

      <Text style={templateStyles.body}>
        <strong>{buyerName}</strong> countered your offer for{' '}
        <strong>{gameName}</strong>.
      </Text>

      <Text style={templateStyles.body}>
        Your offer: {formatCentsToCurrency(originalPriceCents)} → Counter:{' '}
        <strong>{formatCentsToCurrency(counterPriceCents)}</strong>
      </Text>

      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={offersUrl} style={templateStyles.ctaFrost}>
                Review counter
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>
        You have 7 days to accept or decline this counter.
      </Text>
    </EmailLayout>
  );
}
