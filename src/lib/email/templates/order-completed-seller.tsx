/**
 * Order Completed Notification — Seller
 * Sent when the buyer confirms receipt. Tells the seller their earnings will be credited.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';
import { formatCentsToCurrency } from '@/lib/services/pricing';

interface OrderCompletedSellerProps {
  sellerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  earningsCents: number;
  appUrl: string;
}

export function OrderCompletedSeller({
  sellerName,
  orderNumber,
  orderId,
  gameName,
  buyerName,
  earningsCents,
  appUrl,
}: OrderCompletedSellerProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;

  return (
    <EmailLayout preview={`Order complete: ${gameName} — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        The buyer has confirmed receipt — your order is complete.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>

        <Text style={s.detailLabel}>Buyer</Text>
        <Text style={s.detailValue}>{buyerName}</Text>

        <Text style={s.detailLabel}>Your earnings</Text>
        <Text style={s.detailValue}>{formatCentsToCurrency(earningsCents)}</Text>
      </div>

      <Text style={s.body}>
        Your earnings of {formatCentsToCurrency(earningsCents)} will be credited to your wallet.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={orderUrl}>
          View Order
        </Button>
      </div>

      <Text style={s.body}>
        Thank you for selling on Second Turn Games.
      </Text>
    </EmailLayout>
  );
}

export default OrderCompletedSeller;
