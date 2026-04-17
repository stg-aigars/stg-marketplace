/**
 * Order Declined Notification — Buyer
 * Sent when the seller declines the order. Neutral tone, refund info, redirect to browse.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface OrderDeclinedBuyerProps {
  buyerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  paymentMethod?: string | null;
  appUrl: string;
}

export function OrderDeclinedBuyer({
  buyerName,
  orderNumber,
  gameName,
  paymentMethod,
  appUrl,
}: OrderDeclinedBuyerProps) {
  const browseUrl = `${appUrl}/browse`;

  return (
    <EmailLayout preview={`Order update: ${gameName} — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {buyerName},</Text>

      <Text style={s.body}>
        The seller couldn&apos;t fulfil your order. We&apos;ve refunded your payment in full.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>
      </div>

      <Text style={s.body}>
        {paymentMethod === 'bank_link'
          ? 'Your refund has been initiated. Bank transfers typically take 1–3 business days.'
          : paymentMethod === 'card'
            ? 'Your refund has been processed and should appear on your card shortly.'
            : 'Your refund is being processed.'}
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={browseUrl}>
          Browse other games
        </Button>
      </div>
    </EmailLayout>
  );
}

export default OrderDeclinedBuyer;
