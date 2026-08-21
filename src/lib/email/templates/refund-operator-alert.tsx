/**
 * Refund Operator Alert — internal, to the ops inbox.
 *
 * Fires on EVERY refund, whatever the outcome. The completed variant is
 * informational; the blocked variant is a work item — the bank-link rail
 * cannot be reversed, so a human sends the SEPA transfer.
 *
 * Unconditional on purpose: an alert that only arrives on failure trains the
 * reader to ignore a silent inbox, and gives no signal when the refund path
 * itself stops firing. A steady one-per-refund cadence makes absence itself
 * information.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s, theme } from './layout';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import {
  REFUND_BLOCKED_REASON_LABELS,
  type RefundBlockedReason,
} from '@/lib/payments/refundability';

export interface RefundOperatorAlertProps {
  outcome: 'refunded' | 'manual_required' | 'failed';
  amountCents: number;
  paymentMethod: string | null;
  paymentReference: string;
  refundReason: string;
  orderId: string | null;
  orderNumber: string | null;
  buyerName: string | null;
  blockedReason: RefundBlockedReason | null;
  failureCode: number | null;
  failureMessage: string | null;
  appUrl: string;
}

const OUTCOME_HEADLINE: Record<RefundOperatorAlertProps['outcome'], string> = {
  refunded: 'The gateway refund went through. No action needed.',
  manual_required:
    'The gateway could not reverse this payment. Send the refund by bank transfer.',
  failed:
    'The gateway refund failed. It will be retried automatically — check back if it stays unresolved.',
};

const calloutStyle = {
  backgroundColor: theme.bgElevated,
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '0 0 24px',
};

export function RefundOperatorAlert({
  outcome,
  amountCents,
  paymentMethod,
  paymentReference,
  refundReason,
  orderId,
  orderNumber,
  buyerName,
  blockedReason,
  failureCode,
  failureMessage,
  appUrl,
}: RefundOperatorAlertProps) {
  const label = orderNumber ?? paymentReference;
  const staffUrl = orderId
    ? `${appUrl}/staff/orders?q=${encodeURIComponent(orderNumber ?? orderId)}`
    : `${appUrl}/staff/orders`;

  return (
    <EmailLayout preview={`Refund ${outcome} — ${label}`}>
      <Text style={s.greeting}>{OUTCOME_HEADLINE[outcome]}</Text>

      <div style={s.orderCard}>
        <Text style={s.orderLabel}>{orderNumber ? 'Order' : 'Payment'}</Text>
        <Text style={s.orderNumber}>{label}</Text>

        <Text style={s.detailLabel}>Amount</Text>
        <Text style={s.detailValue}>{formatCentsToCurrency(amountCents)}</Text>

        <Text style={s.detailLabel}>Buyer</Text>
        <Text style={s.detailValue}>{buyerName ?? 'Unknown'}</Text>

        <Text style={s.detailLabel}>Payment method</Text>
        <Text style={s.detailValue}>{paymentMethod ?? 'unknown'}</Text>

        <Text style={s.detailLabel}>Reason for refund</Text>
        <Text style={s.detailValue}>{refundReason}</Text>

        <Text style={s.detailLabel}>EveryPay payment reference</Text>
        <Text style={s.detailValue}>{paymentReference}</Text>
      </div>

      {outcome === 'manual_required' && (
        <div style={calloutStyle}>
          <Text style={s.detailLabel}>Why it was blocked</Text>
          <Text style={s.detailValue}>
            {blockedReason
              ? REFUND_BLOCKED_REASON_LABELS[blockedReason]
              : 'Gateway rejected the refund'}
            {failureCode ? ` (code ${failureCode})` : ''}
          </Text>
          <Text style={s.note}>
            Read the buyer&apos;s IBAN from the Swedbank account statement or the
            EveryPay dashboard entry for {paymentReference}, send the transfer of{' '}
            {formatCentsToCurrency(amountCents)}, then mark it resolved in the
            refunds queue.
          </Text>
        </div>
      )}

      {outcome === 'failed' && failureMessage && (
        <div style={calloutStyle}>
          <Text style={s.detailLabel}>Gateway response</Text>
          <Text style={s.detailValue}>
            {failureMessage}
            {failureCode ? ` (code ${failureCode})` : ''}
          </Text>
        </div>
      )}

      <div style={s.ctaSection}>
        <Button
          style={outcome === 'manual_required' ? s.ctaOrange : s.ctaFrost}
          href={outcome === 'manual_required' ? `${appUrl}/staff/refunds` : staffUrl}
        >
          {outcome === 'manual_required' ? 'Open refunds queue' : 'View in staff area'}
        </Button>
      </div>
    </EmailLayout>
  );
}

export default RefundOperatorAlert;
