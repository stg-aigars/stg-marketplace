/**
 * Order Disputed Notification — Seller
 * Sent when the buyer reports an issue with their order.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles as s } from './layout';

interface OrderDisputedSellerProps {
  sellerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  reason?: string;
  appUrl: string;
}

export function OrderDisputedSeller({
  sellerName,
  orderNumber,
  orderId,
  gameName,
  buyerName,
  reason,
  appUrl,
}: OrderDisputedSellerProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;

  return (
    <EmailLayout preview={`Issue reported: ${gameName} — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        The buyer has reported an issue with their order. Please review the details below.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>

        <Text style={s.detailLabel}>Buyer</Text>
        <Text style={s.detailValue}>{buyerName}</Text>

        {reason && (
          <>
            <Text style={s.detailLabel}>Buyer&#39;s message</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </>
        )}
      </div>

      <Text style={s.body}>
        <strong>What to do</strong>
      </Text>
      <Text style={s.stepList}>
        1. Review the order details{'\n'}
        2. Contact the buyer if needed{'\n'}
        3. If you can&apos;t agree, escalate from the order page
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={orderUrl}>
          View Order
        </Button>
      </div>

      <Text style={s.note}>
        Please respond promptly. Unresolved disputes may be escalated for review.
      </Text>
    </EmailLayout>
  );
}

// Template-specific styles only
const styles = {
  reasonText: {
    color: theme.textPrimary,
    fontSize: '15px',
    fontWeight: '500' as const,
    fontStyle: 'italic' as const,
    margin: '2px 0 12px',
  },
} as const;

export default OrderDisputedSeller;
