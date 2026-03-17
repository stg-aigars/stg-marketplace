/**
 * New Order Notification — Seller
 * Sent when a buyer purchases a listing. Most critical email for trust.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles as s } from './layout';
import { formatCentsToCurrency } from '@/lib/services/pricing';

interface NewOrderSellerProps {
  sellerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  priceCents: number;
  shippingCents: number;
  terminalName: string;
  appUrl: string;
}

export function NewOrderSeller({
  sellerName,
  orderNumber,
  orderId,
  gameName,
  buyerName,
  priceCents,
  shippingCents,
  terminalName,
  appUrl,
}: NewOrderSellerProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;

  return (
    <EmailLayout preview={`New order for ${gameName} — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        You have a new order. A buyer is waiting for your response.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>

        <Text style={s.detailLabel}>Buyer</Text>
        <Text style={s.detailValue}>{buyerName}</Text>

        <Text style={s.detailLabel}>Price</Text>
        <Text style={s.detailValue}>{formatCentsToCurrency(priceCents)}</Text>

        <Text style={s.detailLabel}>Shipping</Text>
        <Text style={s.detailValue}>{formatCentsToCurrency(shippingCents)}</Text>

        <Text style={s.detailLabel}>Destination</Text>
        <Text style={s.detailValue}>{terminalName}</Text>
      </div>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={orderUrl}>
          Review Order
        </Button>
      </div>

      <Text style={styles.noteSecondary}>
        Please accept or decline within 48 hours. The buyer has already paid —
        if you accept, you will receive a parcel ID and drop-off instructions.
      </Text>

      <Text style={s.body}>
        Thank you for selling on Second Turn Games.
      </Text>
    </EmailLayout>
  );
}

// Template-specific styles only
const styles = {
  noteSecondary: {
    color: theme.textSecondary,
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0 0 16px',
  },
} as const;

export default NewOrderSeller;
