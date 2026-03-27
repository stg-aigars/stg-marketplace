/**
 * Delivery Reminder — Buyer
 * Sent 14 days after shipping if no delivery confirmation received.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface DeliveryReminderBuyerProps {
  buyerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  daysSinceShipped: number;
  appUrl: string;
}

export function DeliveryReminderBuyer({
  buyerName,
  orderNumber,
  orderId,
  gameName,
  daysSinceShipped,
  appUrl,
}: DeliveryReminderBuyerProps) {
  return (
    <EmailLayout preview={`Have you picked up your parcel? — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {buyerName},</Text>

      <Text style={s.body}>
        Your order for <strong>{gameName}</strong> was shipped {daysSinceShipped} days
        ago. If you have picked it up from the terminal, please confirm delivery
        so the seller can receive their payment.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>
      </div>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={`${appUrl}/orders/${orderId}`}>
          Confirm Delivery
        </Button>
      </div>

      <Text style={s.body}>
        If you haven&apos;t received your parcel yet, please check the terminal
        or contact us for help.
      </Text>
    </EmailLayout>
  );
}

export default DeliveryReminderBuyer;
