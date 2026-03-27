/**
 * Seller Response Reminder
 * Sent 24h after order creation if seller hasn't accepted/declined.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface SellerResponseReminderProps {
  sellerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  hoursRemaining: number;
  appUrl: string;
}

export function SellerResponseReminder({
  sellerName,
  orderNumber,
  orderId,
  gameName,
  buyerName,
  hoursRemaining,
  appUrl,
}: SellerResponseReminderProps) {
  return (
    <EmailLayout preview={`Reminder: Respond to order ${orderNumber}`}>
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        You have approximately {hoursRemaining} hours left to respond to an order
        from {buyerName} for <strong>{gameName}</strong>.
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
        If you don&apos;t accept or decline, the order will be automatically
        cancelled and the buyer will be refunded.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={`${appUrl}/orders/${orderId}`}>
          Review Order
        </Button>
      </div>
    </EmailLayout>
  );
}

export default SellerResponseReminder;
