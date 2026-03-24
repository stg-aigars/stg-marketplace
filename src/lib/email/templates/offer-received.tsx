/**
 * Offer Received Notification — Seller
 * Sent when a buyer makes an offer on a game from the seller's shelf.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { EmailLayout, theme, templateStyles } from './layout';

interface OfferReceivedProps {
  sellerName: string;
  buyerName: string;
  gameName: string;
  amountCents: number;
  note: string | null;
  offersUrl: string;
}

export function OfferReceived({
  sellerName,
  buyerName,
  gameName,
  amountCents,
  note,
  offersUrl,
}: OfferReceivedProps) {
  return (
    <EmailLayout preview={`${buyerName} made an offer on ${gameName}`}>
      <Text style={templateStyles.greeting}>Hi {sellerName},</Text>

      <Text style={templateStyles.body}>
        <strong>{buyerName}</strong> made an offer of{' '}
        <strong>{formatCentsToCurrency(amountCents)}</strong> for{' '}
        <strong>{gameName}</strong>.
      </Text>

      {note && (
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          style={{ margin: '0 0 24px' }}
        >
          <tbody>
            <tr>
              <td style={styles.noteCard}>
                <Text style={styles.noteText}>
                  &ldquo;{note}&rdquo;
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      )}

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
