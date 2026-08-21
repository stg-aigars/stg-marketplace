/**
 * Manual Refund Pending — Buyer
 *
 * Sent when the gateway cannot reverse the buyer's payment and the refund is
 * being sent by bank transfer instead. Follows the cancellation email rather
 * than replacing it: the cancellation says the order is off, this says where
 * the money is. Without it the buyer holds neither the game nor the payment
 * and hears nothing — which is what left the STG-20260816-HGBM buyer waiting
 * four days.
 */

import { Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';
import { formatCentsToCurrency } from '@/lib/services/pricing';

export interface RefundManualPendingBuyerProps {
  buyerName: string;
  orderNumber: string;
  gameName: string;
  amountCents: number;
}

export function RefundManualPendingBuyer({
  buyerName,
  orderNumber,
  gameName,
  amountCents,
}: RefundManualPendingBuyerProps) {
  return (
    <EmailLayout preview={`Your refund for ${orderNumber} is on its way`}>
      <Text style={s.greeting}>Hi {buyerName},</Text>

      <Text style={s.body}>
        Your refund of {formatCentsToCurrency(amountCents)} is on its way. You
        paid through your bank, so we send this one back as a bank transfer to
        the account the payment came from. It usually arrives within 1–2
        business days.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>Order</Text>
        <Text style={s.orderNumber}>{orderNumber}</Text>

        <Text style={s.detailLabel}>Game</Text>
        <Text style={s.detailValue}>{gameName}</Text>

        <Text style={s.detailLabel}>Refund amount</Text>
        <Text style={s.detailValue}>{formatCentsToCurrency(amountCents)}</Text>
      </div>

      <Text style={s.note}>
        You do not need to do anything, and we do not need your bank details —
        we already have them from your payment. If the refund has not arrived
        after two business days, reply to this email and we will chase it.
      </Text>
    </EmailLayout>
  );
}

export default RefundManualPendingBuyer;
