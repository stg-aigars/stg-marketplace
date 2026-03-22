/**
 * Dispute Escalated Notification
 * Sent to both buyer and seller when a dispute is escalated to staff.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface DisputeEscalatedProps {
  recipientName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  appUrl: string;
}

export function DisputeEscalated({
  recipientName,
  orderNumber,
  orderId,
  gameName,
  appUrl,
}: DisputeEscalatedProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;

  return (
    <EmailLayout preview={`Dispute escalated: ${gameName} — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {recipientName},</Text>

      <Text style={s.body}>
        This dispute has been escalated for staff review. Our team will review the details
        and make a decision as soon as possible.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>
      </div>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={orderUrl}>
          View Order
        </Button>
      </div>

      <Text style={s.note}>
        You will be notified when a decision is made.
      </Text>
    </EmailLayout>
  );
}

export default DisputeEscalated;
