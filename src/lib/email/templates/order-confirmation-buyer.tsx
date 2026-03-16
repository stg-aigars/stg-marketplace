/**
 * Order Confirmation — Buyer
 * Sent after payment succeeds and order is created.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles as s } from './layout';
import { formatCentsToCurrency } from '@/lib/services/pricing';

interface OrderConfirmationBuyerProps {
  buyerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  sellerName: string;
  priceCents: number;
  shippingCents: number;
  totalCents: number;
  terminalName: string;
  appUrl: string;
}

export function OrderConfirmationBuyer({
  buyerName,
  orderNumber,
  orderId,
  gameName,
  sellerName,
  priceCents,
  shippingCents,
  totalCents,
  terminalName,
  appUrl,
}: OrderConfirmationBuyerProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;

  return (
    <EmailLayout preview={`Order confirmed — ${gameName}`}>
      <Text style={s.greeting}>Hi {buyerName},</Text>

      <Text style={s.body}>
        Your order has been placed. The seller has been notified and will review
        your order shortly.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>

        <Text style={s.detailLabel}>Seller</Text>
        <Text style={s.detailValue}>{sellerName}</Text>

        <div style={styles.pricingSection}>
          <Text style={styles.priceLine}>
            Item price: {formatCentsToCurrency(priceCents)}
          </Text>
          <Text style={styles.priceLine}>
            Shipping: {formatCentsToCurrency(shippingCents)}
          </Text>
          <Text style={styles.totalLine}>
            Total paid: {formatCentsToCurrency(totalCents)}
          </Text>
        </div>

        <Text style={s.detailLabel}>Pickup location</Text>
        <Text style={s.detailValue}>{terminalName}</Text>
      </div>

      <Text style={s.body}>
        <strong>What happens next?</strong>
      </Text>
      <Text style={s.stepList}>
        1. The seller reviews and accepts your order{'\n'}
        2. The seller ships the game to your parcel locker{'\n'}
        3. You receive a notification when the game arrives{'\n'}
        4. Pick up and confirm delivery
      </Text>

      <div style={s.ctaSection}>
        <Button style={styles.ctaFrost} href={orderUrl}>
          View Order
        </Button>
      </div>

      <Text style={s.note}>
        You will receive an email when the seller ships your game.
      </Text>
    </EmailLayout>
  );
}

// Template-specific styles only
const styles = {
  ctaFrost: {
    backgroundColor: theme.frost,
    borderRadius: '8px',
    color: '#FEFEFE',
    display: 'inline-block' as const,
    fontSize: '15px',
    fontWeight: '600' as const,
    padding: '12px 32px',
    textDecoration: 'none',
  },
  pricingSection: {
    borderTop: `1px solid ${theme.borderSubtle}`,
    margin: '4px 0 12px',
    padding: '12px 0 0',
  },
  priceLine: {
    color: theme.textSecondary,
    fontSize: '14px',
    margin: '0 0 4px',
  },
  totalLine: {
    color: theme.textHeading,
    fontSize: '16px',
    fontWeight: '700' as const,
    margin: '8px 0 0',
  },
} as const;

export default OrderConfirmationBuyer;
