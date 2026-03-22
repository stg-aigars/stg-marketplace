/**
 * Dispute Resolved (Refund) Notification
 * Sent to both buyer and seller when a dispute is resolved with a refund.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles as s } from './layout';

interface DisputeResolvedRefundProps {
  recipientName: string;
  recipientRole: 'buyer' | 'seller';
  orderNumber: string;
  orderId: string;
  gameName: string;
  refundAmountCents: number;
  staffNotes?: string;
  appUrl: string;
}

export function DisputeResolvedRefund({
  recipientName,
  recipientRole,
  orderNumber,
  orderId,
  gameName,
  refundAmountCents,
  staffNotes,
  appUrl,
}: DisputeResolvedRefundProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;
  const formattedAmount = `€${(refundAmountCents / 100).toFixed(2)}`;

  return (
    <EmailLayout preview={`Dispute resolved: ${gameName} — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {recipientName},</Text>

      {recipientRole === 'buyer' ? (
        <Text style={s.body}>
          Your dispute has been resolved. {formattedAmount} has been credited to your wallet.
        </Text>
      ) : (
        <Text style={s.body}>
          The dispute on your order has been resolved with a refund to the buyer.
        </Text>
      )}

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>

        {recipientRole === 'buyer' && (
          <>
            <Text style={s.detailLabel}>Refund amount</Text>
            <Text style={s.detailValue}>{formattedAmount}</Text>
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

      {recipientRole === 'buyer' && (
        <Text style={s.note}>
          You can use your wallet balance for future purchases or request a withdrawal.
        </Text>
      )}
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

export default DisputeResolvedRefund;
