/**
 * Order Shipped Notification — Buyer
 * Sent when the seller marks the order as shipped (dropped at terminal).
 */

import { Button, Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles as s } from './layout';

interface OrderShippedBuyerProps {
  buyerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  barcode?: string;
  trackingUrl?: string;
  terminalName?: string;
  appUrl: string;
}

export function OrderShippedBuyer({
  buyerName,
  orderNumber,
  orderId,
  gameName,
  barcode,
  trackingUrl,
  terminalName,
  appUrl,
}: OrderShippedBuyerProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;

  return (
    <EmailLayout preview={`${gameName} has been shipped — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {buyerName},</Text>

      <Text style={s.body}>
        {terminalName
          ? `Your game is on its way. Your parcel was scanned at ${terminalName}.`
          : 'Your game is on its way. The seller has dropped it off at the parcel terminal.'}
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>

        {barcode && (
          <>
            <Text style={s.detailLabel}>Tracking code</Text>
            <Text style={s.detailValue}>{barcode}</Text>
          </>
        )}

        {trackingUrl && (
          <>
            <Text style={s.detailLabel}>Track shipment</Text>
            <Text style={s.detailValue}>
              <Link href={trackingUrl} style={styles.link}>
                View tracking details
              </Link>
            </Text>
          </>
        )}
      </div>

      <Text style={s.body}>
        <strong>What to do when it arrives</strong>
      </Text>
      <Text style={s.stepList}>
        1. Pick up the parcel from your locker{'\n'}
        2. Check that the game matches the listing description{'\n'}
        3. Mark the order as delivered in your account{'\n'}
        4. Confirm everything is good to complete the order
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={orderUrl}>
          View Order
        </Button>
      </div>

      <Text style={s.note}>
        If something is wrong with your order, you can open a dispute from the order page.
      </Text>
    </EmailLayout>
  );
}

// Template-specific styles only
const styles = {
  link: {
    color: theme.frostDark,
    textDecoration: 'underline' as const,
  },
} as const;

export default OrderShippedBuyer;
