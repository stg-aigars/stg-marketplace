/**
 * Wanted Offer Received — Buyer
 * Sent when a seller makes an offer on the buyer's wanted listing.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { EmailLayout, theme, templateStyles } from './layout';

interface WantedOfferReceivedProps {
  buyerName: string;
  sellerName: string;
  gameName: string;
  condition: string;
  priceCents: number;
  note: string | null;
  wantedUrl: string;
}

export function WantedOfferReceived({
  buyerName,
  sellerName,
  gameName,
  condition,
  priceCents,
  note,
  wantedUrl,
}: WantedOfferReceivedProps) {
  return (
    <EmailLayout preview={`${sellerName} made an offer on your wanted game ${gameName}`}>
      <Text style={templateStyles.greeting}>Hi {buyerName},</Text>

      <Text style={templateStyles.body}>
        <strong>{sellerName}</strong> has offered{' '}
        <strong>{formatCentsToCurrency(priceCents)}</strong> for{' '}
        <strong>{gameName}</strong> in <strong>{condition}</strong> condition.
      </Text>

      {note && (
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={{ margin: '0 0 24px' }}>
          <tbody>
            <tr>
              <td style={styles.noteCard}>
                <Text style={styles.noteText}>&ldquo;{note}&rdquo;</Text>
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={wantedUrl} style={templateStyles.ctaFrost}>
                View offers
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>
        You have 7 days to accept, counter, or decline this offer.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  noteCard: {
    backgroundColor: theme.bgElevated,
    borderRadius: '8px',
    padding: '16px 20px',
    borderLeft: `3px solid ${theme.frost}`,
  },
  noteText: {
    color: theme.textSecondary,
    fontSize: '14px',
    lineHeight: '22px',
    fontStyle: 'italic' as const,
    margin: '0',
  },
} as const;
