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
  appUrl: string;
}

export function OrderDeclinedBuyer({
  buyerName,
  orderNumber,
  gameName,
  appUrl,
}: OrderDeclinedBuyerProps) {
  const browseUrl = `${appUrl}/browse`;

  return (
    <EmailLayout preview={`Order update: ${gameName} — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {buyerName},</Text>

      <Text style={s.body}>
        Unfortunately, the seller was unable to fulfill your order. We are sorry for the inconvenience.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>
      </div>

      <Text style={s.body}>
        Your payment will be refunded automatically. Refunds typically appear within 3–5 business days depending on your bank.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={browseUrl}>
          Browse other games
        </Button>
      </div>

      <Text style={s.note}>
        New games are listed every day — your next find might already be waiting.
      </Text>
    </EmailLayout>
  );
}

export default OrderDeclinedBuyer;
