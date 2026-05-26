/**
 * Wanted Listing Price Dropped — Buyer
 * Sent when a seller drops the price on a fixed-price listing matching the
 * buyer's wanted list. 14-day dedup applied upstream — buyer gets at most
 * one of these per listing per fortnight.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { EmailLayout, theme, templateStyles } from './layout';

interface WantedListingPriceDroppedProps {
  buyerName: string;
  sellerName: string;
  gameName: string;
  fromCents: number;
  toCents: number;
  condition: string;
  listingEdition: string | null;
  buyerEditionPreference: string | null;
  listingUrl: string;
}

export function WantedListingPriceDropped({
  buyerName,
  sellerName,
  gameName,
  fromCents,
  toCents,
  condition,
  listingEdition,
  buyerEditionPreference,
  listingUrl,
}: WantedListingPriceDroppedProps) {
  return (
    <EmailLayout preview={`${gameName} dropped to ${formatCentsToCurrency(toCents)}`}>
      <Text style={templateStyles.greeting}>Hi {buyerName},</Text>

      <Text style={templateStyles.body}>
        <strong>{sellerName}</strong> dropped the price on <strong>{gameName}</strong> from{' '}
        <s style={styles.struck}>{formatCentsToCurrency(fromCents)}</s>{' '}
        to <strong>{formatCentsToCurrency(toCents)}</strong> ({condition} condition).
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
  struck: {
    color: theme.textMuted,
  },
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
