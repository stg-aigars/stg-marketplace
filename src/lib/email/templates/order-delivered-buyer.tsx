/**
 * Order Delivered Notification — Buyer
 * Sent when the buyer picks up the parcel (via Unisend tracking or manual confirm).
 * Prompts them to check the game and explains the 2-day dispute window.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface OrderDeliveredBuyerProps {
  buyerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  appUrl: string;
}

export function OrderDeliveredBuyer({
  buyerName,
  orderNumber,
  orderId,
  gameName,
  appUrl,
}: OrderDeliveredBuyerProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;

  return (
    <EmailLayout preview={`Picked up: ${gameName} — please confirm`}>
      <Text style={s.greeting}>Hi {buyerName},</Text>

      <Text style={s.body}>
        You have picked up your game. Two minutes of your time finishes the order:
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>
      </div>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={orderUrl}>
          Confirm Received
        </Button>
      </div>

      <Text style={s.body}>
        Once you have confirmed everything looks good, you can leave a review for the seller to help other buyers in the community.
      </Text>

      <Text style={s.note}>
        If there is an issue with your order, you have 2 days to report it from the order page. After that, the order will be completed automatically and the seller will be paid.
      </Text>
    </EmailLayout>
  );
}

export default OrderDeliveredBuyer;
