/**
 * Dispute Resolved (No Refund) Notification
 * Sent to both buyer and seller when a dispute is resolved in the seller's favor.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles as s } from './layout';

interface DisputeResolvedNoRefundProps {
  recipientName: string;
  recipientRole: 'buyer' | 'seller';
  orderNumber: string;
  orderId: string;
  gameName: string;
  earningsCents: number;
  staffNotes?: string;
  appUrl: string;
}

export function DisputeResolvedNoRefund({
  recipientName,
  recipientRole,
  orderNumber,
  orderId,
  gameName,
  earningsCents,
  staffNotes,
  appUrl,
}: DisputeResolvedNoRefundProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;
  const formattedEarnings = `€${(earningsCents / 100).toFixed(2)}`;

  return (
    <EmailLayout preview={`Dispute resolved: ${gameName} — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {recipientName},</Text>

      {recipientRole === 'buyer' ? (
        <Text style={s.body}>
          The dispute on your order has been resolved. The order is now complete.
        </Text>
      ) : (
        <Text style={s.body}>
          The dispute on your order has been resolved in your favor. Your earnings of{' '}
          {formattedEarnings} have been credited to your wallet.
        </Text>
      )}

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>

        {recipientRole === 'seller' && (
          <>
            <Text style={s.detailLabel}>Earnings</Text>
            <Text style={s.detailValue}>{formattedEarnings}</Text>
          </>
        )}
      </div>

      {staffNotes && (
        <>
          <Text style={s.body}>
            <strong>Staff notes</strong>
          </Text>
          <Text style={styles.staffNotesText}>{staffNotes}</Text>
        </>
      )}

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={orderUrl}>
          View Order
        </Button>
      </div>
    </EmailLayout>
  );
}

// Template-specific styles only
const styles = {
  staffNotesText: {
    color: theme.textPrimary,
    fontSize: '15px',
    fontWeight: '500' as const,
    fontStyle: 'italic' as const,
    margin: '2px 0 24px',
  },
} as const;

export default DisputeResolvedNoRefund;
