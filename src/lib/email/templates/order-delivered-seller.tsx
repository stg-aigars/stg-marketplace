/**
 * Order Delivered Notification — Seller
 * Sent when the buyer picks up the parcel (via Unisend tracking or manual confirm).
 * Informs the seller that delivery is confirmed and the dispute window has started.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface OrderDeliveredSellerProps {
  sellerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  appUrl: string;
}

export function OrderDeliveredSeller({
  sellerName,
  orderNumber,
  orderId,
  gameName,
  buyerName,
  appUrl,
}: OrderDeliveredSellerProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;

  return (
    <EmailLayout preview={`Delivered: ${gameName} — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        {buyerName} has picked up the parcel for order {orderNumber}. The delivery is confirmed.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>

        <Text style={s.detailLabel}>Buyer</Text>
        <Text style={s.detailValue}>{buyerName}</Text>
      </div>

      <Text style={s.body}>
        The buyer has 2 days to confirm everything is in order. Once confirmed, your earnings will be credited to your wallet.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={orderUrl}>
          View Order
        </Button>
      </div>
    </EmailLayout>
  );
}

export default OrderDeliveredSeller;
