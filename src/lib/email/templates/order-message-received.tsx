/**
 * Order Message Received — Buyer/Seller
 * Sent immediately when the other party on an order posts a message.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles } from './layout';

interface OrderMessageReceivedProps {
  recipientName: string;
  senderName: string;
  orderNumber: string;
  orderId: string;
  messageBody: string;
  appUrl: string;
}

export function OrderMessageReceived({
  recipientName,
  senderName,
  orderNumber,
  orderId,
  messageBody,
  appUrl,
}: OrderMessageReceivedProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;

  return (
    <EmailLayout preview={`${senderName} messaged you about order ${orderNumber}`}>
      <Text style={templateStyles.greeting}>Hi {recipientName},</Text>

      <Text style={templateStyles.body}>
        <strong>{senderName}</strong> sent you a message about order <strong>{orderNumber}</strong>.
      </Text>

      <div style={styles.messageBlock}>
        <Text style={styles.messageBody}>{truncate(messageBody, 200)}</Text>
      </div>

      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={orderUrl} style={templateStyles.ctaFrost}>
                View order
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>
        Reply on the order page to continue the conversation with {senderName}.
      </Text>
    </EmailLayout>
  );
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

const styles = {
  messageBlock: {
    backgroundColor: theme.bgElevated,
    borderRadius: '6px',
    padding: '12px 16px',
    margin: '0 0 24px',
  },
  messageBody: {
    color: theme.textPrimary,
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0',
    whiteSpace: 'pre-wrap' as const,
  },
} as const;
