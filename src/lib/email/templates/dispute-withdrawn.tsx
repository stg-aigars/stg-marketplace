/**
 * Dispute Withdrawn Notification — Seller
 * Sent to the seller when the buyer withdraws their dispute.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface DisputeWithdrawnProps {
  sellerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  earningsCents: number;
  appUrl: string;
}

export function DisputeWithdrawn({
  sellerName,
  orderNumber,
  orderId,
  gameName,
  buyerName,
  earningsCents,
  appUrl,
}: DisputeWithdrawnProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;
  const formattedEarnings = `€${(earningsCents / 100).toFixed(2)}`;

  return (
    <EmailLayout preview={`Dispute withdrawn: ${gameName} — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        The buyer has withdrawn their dispute. The order is now complete and your earnings
        of {formattedEarnings} have been credited to your wallet.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>

        <Text style={s.detailLabel}>Buyer</Text>
        <Text style={s.detailValue}>{buyerName}</Text>

        <Text style={s.detailLabel}>Earnings</Text>
        <Text style={s.detailValue}>{formattedEarnings}</Text>
      </div>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={orderUrl}>
          View Order
        </Button>
      </div>
    </EmailLayout>
  );
}

export default DisputeWithdrawn;
