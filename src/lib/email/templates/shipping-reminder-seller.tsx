/**
 * Shipping Reminder — Seller
 * Sent at day 3 of accepted status, 2 days before auto-cancellation.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface ShippingReminderSellerProps {
  sellerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  daysRemaining: number;
  appUrl: string;
}

export function ShippingReminderSeller({
  sellerName,
  orderNumber,
  orderId,
  gameName,
  daysRemaining,
  appUrl,
}: ShippingReminderSellerProps) {
  return (
    <EmailLayout preview={`Reminder: Ship order ${orderNumber}`}>
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        You have {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left to
        ship <strong>{gameName}</strong>. If you don&apos;t mark it as shipped,
        the order will be cancelled and the buyer refunded.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>
      </div>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={`${appUrl}/orders/${orderId}`}>
          View Order
        </Button>
      </div>
    </EmailLayout>
  );
}

export default ShippingReminderSeller;
