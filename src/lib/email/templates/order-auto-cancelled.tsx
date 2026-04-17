/**
 * Order Auto-Cancelled
 * Sent when an order is automatically cancelled due to seller inaction.
 * Handles two reasons (response timeout / shipping timeout) and two variants (buyer / seller).
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles as s } from './layout';

type CancelReason = 'response_timeout' | 'shipping_timeout';
type Variant = 'buyer' | 'seller';

interface OrderAutoCancelledProps {
  recipientName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  reason: CancelReason;
  variant: Variant;
  paymentMethod?: string | null;
  appUrl: string;
}

const REASON_BASE: Record<CancelReason, Record<Variant, string>> = {
  response_timeout: {
    buyer:
      'Your order was automatically cancelled because the seller did not respond within 48 hours.',
    seller:
      'You did not respond to this order within 48 hours, so it was automatically cancelled. The buyer has been refunded.',
  },
  shipping_timeout: {
    buyer:
      'Your order was automatically cancelled because the seller did not ship it within the required timeframe.',
    seller:
      'You did not ship this order within 5 days of accepting it, so it was automatically cancelled. The buyer has been refunded.',
  },
};

function getRefundNote(paymentMethod?: string | null): string {
  if (paymentMethod === 'bank_link') return ' Your refund has been initiated. Bank transfers typically take 1–3 business days.';
  if (paymentMethod === 'card') return ' Your refund has been processed and should appear on your card shortly.';
  return ' Your payment will be refunded.';
}

export function OrderAutoCancelled({
  recipientName,
  orderNumber,
  orderId,
  gameName,
  reason,
  variant,
  paymentMethod,
  appUrl,
}: OrderAutoCancelledProps) {
  const base = REASON_BASE[reason][variant];
  const message = variant === 'buyer' ? base + getRefundNote(paymentMethod) : base;

  return (
    <EmailLayout preview={`Order cancelled: ${gameName} — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {recipientName},</Text>

      <Text style={s.body}>{message}</Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>
      </div>

      <div style={s.ctaSection}>
        <Button
          style={s.ctaFrost}
          href={variant === 'buyer' ? `${appUrl}/browse` : `${appUrl}/orders/${orderId}`}
        >
          {variant === 'buyer' ? 'Browse other games' : 'View order'}
        </Button>
      </div>

      {variant === 'seller' && (
        <Text style={styles.note}>
          Responding within 48 hours keeps orders from auto-cancelling.
        </Text>
      )}
    </EmailLayout>
  );
}

const styles = {
  note: {
    color: theme.textSecondary,
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0 0 16px',
  },
} as const;

export default OrderAutoCancelled;
