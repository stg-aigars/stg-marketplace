/**
 * Order Accepted Notification — Buyer
 * Sent when the seller accepts the order and shipping is being prepared.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface OrderAcceptedBuyerProps {
  buyerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  sellerName: string;
  appUrl: string;
}

export function OrderAcceptedBuyer({
  buyerName,
  orderNumber,
  orderId,
  gameName,
  sellerName,
  appUrl,
}: OrderAcceptedBuyerProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;

  return (
    <EmailLayout preview={`${gameName} — order accepted by ${sellerName}`}>
      <Text style={s.greeting}>Hi {buyerName},</Text>

      <Text style={s.body}>
        Good news — {sellerName} has accepted your order and is preparing to ship your game.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>
      </div>

      <Text style={s.body}>
        <strong>What happens next</strong>
      </Text>
      <Text style={s.stepList}>
        1. The seller will drop the game at a parcel terminal{'\n'}
        2. You will receive an email when it ships{'\n'}
        3. Pick up from your selected terminal
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={orderUrl}>
          View Order
        </Button>
      </div>

      <Text style={s.note}>
        You will receive another email when the seller ships your game.
      </Text>
    </EmailLayout>
  );
}

export default OrderAcceptedBuyer;
