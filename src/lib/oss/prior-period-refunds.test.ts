import { describe, it, expect } from 'vitest';
import {
  aggregatePriorPeriodRefunds,
  type PriorRefundRow,
} from './prior-period-refunds';

const fullRefund = (overrides: Partial<PriorRefundRow> = {}): PriorRefundRow => ({
  seller_country: 'LT',
  total_amount_cents: 12100,
  refund_amount_cents: 12100,
  commission_vat_cents: 210,
  shipping_vat_cents: 105,
  ...overrides,
});

describe('aggregatePriorPeriodRefunds', () => {
  it('returns an empty record when no rows', () => {
    expect(aggregatePriorPeriodRefunds([])).toEqual({});
  });

  it('reverses the full original VAT for full refunds', () => {
    const result = aggregatePriorPeriodRefunds([fullRefund()]);
    expect(result.LT).toEqual({
      orderCount: 1,
      vatReversalCents: 315, // 210 + 105
      netReversalCents: 12100 - 315,
    });
  });

  it('scales VAT reversal proportionally for partial refunds', () => {
    // €121 order, 50% partial refund → half the VAT reverses
    const result = aggregatePriorPeriodRefunds([
      fullRefund({ refund_amount_cents: 6050, commission_vat_cents: 210, shipping_vat_cents: 105 }),
    ]);
    // (210 + 105) * 0.5 = 157.5 → round to 158
    expect(result.LT?.vatReversalCents).toBe(158);
    expect(result.LT?.netReversalCents).toBe(6050 - 158);
  });

  it('groups by MS and sums per-order values', () => {
    const result = aggregatePriorPeriodRefunds([
      fullRefund({ seller_country: 'LT' }),
      fullRefund({ seller_country: 'LT', total_amount_cents: 5000, refund_amount_cents: 5000, commission_vat_cents: 100, shipping_vat_cents: 50 }),
      fullRefund({ seller_country: 'EE' }),
    ]);
    expect(result.LT?.orderCount).toBe(2);
    expect(result.LT?.vatReversalCents).toBe(315 + 150);
    expect(result.EE?.orderCount).toBe(1);
  });

  it('drops rows with non-OSS member-state seller_country', () => {
    const result = aggregatePriorPeriodRefunds([
      fullRefund({ seller_country: 'LV' }), // home country, must not appear here
      fullRefund({ seller_country: 'DE' }), // outside OSS scope STG declares for
      fullRefund({ seller_country: 'LT' }),
    ]);
    expect(Object.keys(result)).toEqual(['LT']);
    expect(result.LT?.orderCount).toBe(1);
  });

  it('skips rows with zero total to avoid division by zero', () => {
    const result = aggregatePriorPeriodRefunds([
      fullRefund({ total_amount_cents: 0, refund_amount_cents: 0 }),
      fullRefund(),
    ]);
    expect(result.LT?.orderCount).toBe(1);
  });

  it('normalises seller_country casing so lowercase/null-safe', () => {
    const result = aggregatePriorPeriodRefunds([
      fullRefund({ seller_country: 'lt' }),
      fullRefund({ seller_country: 'ee' }),
    ]);
    expect(result.LT?.orderCount).toBe(1);
    expect(result.EE?.orderCount).toBe(1);
  });

  it('treats null commission/shipping VAT as zero', () => {
    const result = aggregatePriorPeriodRefunds([
      fullRefund({ commission_vat_cents: null, shipping_vat_cents: null }),
    ]);
    expect(result.LT?.vatReversalCents).toBe(0);
    expect(result.LT?.netReversalCents).toBe(12100);
  });

  it('preserves net + vat == refund_amount_cents per order (no double-rounding)', () => {
    // Engineered values: 11 orders at €12.99 each, full refund
    const rows: PriorRefundRow[] = Array.from({ length: 11 }, () => ({
      seller_country: 'LT',
      total_amount_cents: 1299,
      refund_amount_cents: 1299,
      commission_vat_cents: 23, // not exact 21% — represents stored split
      shipping_vat_cents: 0,
    }));
    const result = aggregatePriorPeriodRefunds(rows);
    expect(result.LT?.netReversalCents).toBe(11 * (1299 - 23));
    expect(result.LT?.vatReversalCents).toBe(11 * 23);
    // Sum check: net + vat must equal sum of refund_amount_cents
    expect(result.LT!.netReversalCents + result.LT!.vatReversalCents).toBe(11 * 1299);
  });
});
