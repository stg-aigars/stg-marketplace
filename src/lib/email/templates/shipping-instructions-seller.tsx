/**
 * Shipping Instructions — Seller
 * Sent when a parcel is created for an accepted T2T order.
 * Tells the seller their parcel ID and how to drop off at any Unisend terminal.
 */

import { Button, Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles as s } from './layout';

interface ShippingInstructionsSellerProps {
  sellerName: string;
  orderNumber: string;
  orderId: string;
  buyerName: string;
  destinationTerminalName: string;
  destinationTerminalAddress: string;
  parcelId: string;
  barcode?: string;
  trackingUrl?: string;
  appUrl: string;
}

export function ShippingInstructionsSeller({
  sellerName,
  orderNumber,
  orderId,
  buyerName,
  destinationTerminalName,
  destinationTerminalAddress,
  parcelId,
  barcode,
  trackingUrl,
  appUrl,
}: ShippingInstructionsSellerProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;

  return (
    <EmailLayout preview={`Shipping ready for order ${orderNumber} — drop off at any Unisend terminal`}>
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        Order {orderNumber} has been accepted and shipping is ready. Here is everything
        you need to drop off the game at any Unisend parcel terminal.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Buyer</Text>
        <Text style={s.detailValue}>{buyerName}</Text>

        <Text style={s.detailLabel}>Your parcel ID</Text>
        <Text style={styles.parcelId}>{parcelId}</Text>

        <Text style={s.detailLabel}>Destination terminal</Text>
        <Text style={s.detailValue}>{destinationTerminalName}</Text>
        {destinationTerminalAddress && (
          <Text style={styles.terminalAddress}>{destinationTerminalAddress}</Text>
        )}

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
        <strong>How to send the game</strong>
      </Text>
      <Text style={s.stepList}>
        1. Visit any Unisend parcel terminal{'\n'}
        2. Enter the parcel ID shown above{'\n'}
        3. Place the game in the locker
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={orderUrl}>
          View Order
        </Button>
      </div>

      <Text style={s.note}>
        Once you have dropped off the parcel, mark the order as shipped from the order page.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  parcelId: {
    color: theme.textHeading,
    fontSize: '28px',
    fontWeight: '700' as const,
    letterSpacing: '1px',
    margin: '4px 0 16px',
  },
  terminalAddress: {
    color: theme.textMuted,
    fontSize: '13px',
    margin: '-8px 0 12px',
  },
  link: {
    color: theme.frostDark,
    textDecoration: 'underline' as const,
  },
} as const;

export default ShippingInstructionsSeller;
