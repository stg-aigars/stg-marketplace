/**
 * Prior-period refund aggregation for OSS quarterly returns.
 *
 * Article 369i / 369k of Directive 2006/112/EC permit the current period's
 * declared amount to be reduced by reversals of supplies declared in earlier
 * quarters, provided the audit trail shows which refunds were treated this
 * way. This module aggregates the refunded-this-quarter / created-prior
 * cohort by MS so the OSS surface can render the adjustment line.
 *
 * Rounding contract (matches aggregateVatByMS):
 *   Integer cents in, integer cents out. Per-order calculation rounds the
 *   VAT-reversal portion once via Math.round, then derives net by subtraction
 *   so net + vat == refund_amount_cents exactly. Aggregation sums those
 *   rounded per-order values — no double-rounding at the aggregate level.
 */

import { OSS_MEMBER_STATES, type OssMemberState } from './types';

export interface PriorRefundRow {
  seller_country: string;
  total_amount_cents: number;
  refund_amount_cents: number;
  commission_vat_cents: number | null;
  shipping_vat_cents: number | null;
}

export interface PriorRefundAggregate {
  orderCount: number;
  netReversalCents: number;
  vatReversalCents: number;
}

/**
 * Aggregate prior-period refunds by MS. For each refunded order:
 *   proportion = refund_amount_cents / total_amount_cents
 *   vat_reversal = round((commission_vat + shipping_vat) * proportion)
 *   net_reversal = refund_amount_cents - vat_reversal
 *
 * Full refunds collapse to proportion = 1 (full original VAT reversed);
 * partial refunds scale proportionally.
 */
export function aggregatePriorPeriodRefunds(
  rows: PriorRefundRow[],
): Partial<Record<OssMemberState, PriorRefundAggregate>> {
  const result: Partial<Record<OssMemberState, PriorRefundAggregate>> = {};
  for (const row of rows) {
    // Defensive uppercase: matches aggregateVatByMS so a stray lowercase row
    // doesn't get silently dropped if the upstream CHECK constraint is ever
    // relaxed.
    const ms = row.seller_country?.toUpperCase() as OssMemberState | undefined;
    if (!ms || !OSS_MEMBER_STATES.includes(ms)) continue;
    if (row.total_amount_cents === 0) continue;

    const proportion = row.refund_amount_cents / row.total_amount_cents;
    const originalVat = (row.commission_vat_cents ?? 0) + (row.shipping_vat_cents ?? 0);
    const vatReversal = Math.round(originalVat * proportion);
    const netReversal = row.refund_amount_cents - vatReversal;

    const existing = result[ms] ?? { orderCount: 0, netReversalCents: 0, vatReversalCents: 0 };
    existing.orderCount += 1;
    existing.netReversalCents += netReversal;
    existing.vatReversalCents += vatReversal;
    result[ms] = existing;
  }
  return result;
}
