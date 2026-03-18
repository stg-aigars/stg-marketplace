/**
 * Order Delivered Notification — Buyer
 * Sent when the buyer picks up the parcel (marks delivered).
 * Prompts them to confirm the game condition.
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
        You have picked up your game. Please take a moment to check that everything is in order.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>
      </div>

      <Text style={s.body}>
        <strong>What to do now</strong>
      </Text>
      <Text style={s.stepList}>
        1. Check the game condition matches the listing description{'\n'}
        2. Confirm everything is good to complete the order{'\n'}
        3. If something is wrong, report an issue from the order page
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={orderUrl}>
          Confirm Received
        </Button>
      </div>

      <Text style={s.body}>
        Once you have confirmed everything looks good, you can leave a review for the seller to help other buyers in the community.
      </Text>

      <Text style={s.note}>
        Please confirm within 2 days. If you do not respond, the order will be completed automatically.
      </Text>
    </EmailLayout>
  );
}

export default OrderDeliveredBuyer;
