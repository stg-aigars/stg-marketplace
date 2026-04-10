/**
 * Wanted Listing Matched — Buyer
 * Sent when a seller lists a game that matches the buyer's wanted listing.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { EmailLayout, theme, templateStyles } from './layout';

interface WantedListingMatchedProps {
  buyerName: string;
  sellerName: string;
  gameName: string;
  priceCents: number;
  condition: string;
  listingEdition: string | null;
  buyerEditionPreference: string | null;
  listingUrl: string;
}

export function WantedListingMatched({
  buyerName,
  sellerName,
  gameName,
  priceCents,
  condition,
  listingEdition,
  buyerEditionPreference,
  listingUrl,
}: WantedListingMatchedProps) {
  return (
    <EmailLayout preview={`${gameName} you're looking for was just listed`}>
      <Text style={templateStyles.greeting}>Hi {buyerName},</Text>

      <Text style={templateStyles.body}>
        <strong>{sellerName}</strong> just listed <strong>{gameName}</strong> for{' '}
        <strong>{formatCentsToCurrency(priceCents)}</strong> in{' '}
        <strong>{condition}</strong> condition.
      </Text>

      {listingEdition && (
        <Text style={styles.editionText}>
          Edition: {listingEdition}
        </Text>
      )}

      {buyerEditionPreference && (
        <Text style={styles.preferenceText}>
          Your preference: {buyerEditionPreference}
        </Text>
      )}

      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={listingUrl} style={templateStyles.ctaFrost}>
                View listing
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}

const styles = {
  editionText: {
    color: theme.textSecondary,
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0 0 4px',
  },
  preferenceText: {
    color: theme.textMuted,
    fontSize: '13px',
    lineHeight: '20px',
    margin: '0 0 24px',
    fontStyle: 'italic' as const,
  },
} as const;
