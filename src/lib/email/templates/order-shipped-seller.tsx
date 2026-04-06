/**
 * Order Shipped Notification — Seller
 * Sent when PARCEL_RECEIVED triggers the auto-ship transition.
 * Confirms the seller's parcel was picked up and is in transit.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';
import { getCountryName } from '@/lib/country-utils';

interface OrderShippedSellerProps {
  sellerName: string;
  orderNumber: string;
  orderId: string;
  gameName: string;
  buyerName: string;
  terminalName?: string;
  terminalCountry?: string;
  isCrossBorder: boolean;
  appUrl: string;
}

export function OrderShippedSeller({
  sellerName,
  orderNumber,
  orderId,
  gameName,
  buyerName,
  terminalName,
  terminalCountry,
  isCrossBorder,
  appUrl,
}: OrderShippedSellerProps) {
  const orderUrl = `${appUrl}/orders/${orderId}`;

  return (
    <EmailLayout preview={`Parcel picked up — ${orderNumber}`}>
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        Your parcel for order {orderNumber} has been picked up from the terminal and is on its way to the buyer.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>

        <Text style={s.detailLabel}>Buyer</Text>
        <Text style={s.detailValue}>{buyerName}</Text>

        {terminalName && (
          <>
            <Text style={s.detailLabel}>Pickup terminal</Text>
            <Text style={s.detailValue}>
              {terminalName}{terminalCountry ? `, ${getCountryName(terminalCountry)}` : ''}
            </Text>
          </>
        )}
      </div>

      <Text style={s.body}>
        {isCrossBorder
          ? 'Cross-border Baltic deliveries typically take 2–3 working days.'
          : 'Same-country deliveries typically arrive the next working day.'}
      </Text>

      <Text style={s.body}>
        You will receive another email when the buyer confirms receipt and your earnings are credited.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={orderUrl}>
          View Order
        </Button>
      </div>
    </EmailLayout>
  );
}

export default OrderShippedSeller;
