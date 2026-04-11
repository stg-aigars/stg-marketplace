import { describe, it, expect } from 'vitest';
import {
  calculateBuyerPricing,
  calculateSellerEarnings,
  calculateOrderPricing,
  calculateCheckoutPricing,
  formatPrice,
  formatCentsToEuros,
  formatCentsToCurrency,
  getVatRate,
  calculateVatSplit,
} from './pricing';

describe('calculateBuyerPricing', () => {
  it('returns item + shipping = total', () => {
    const result = calculateBuyerPricing(2000, 350);
    expect(result.itemsTotalCents).toBe(2000);
    expect(result.shippingCostCents).toBe(350);
    expect(result.totalChargeCents).toBe(2350);
  });

  it('handles zero shipping', () => {
    const result = calculateBuyerPricing(1500, 0);
    expect(result.totalChargeCents).toBe(1500);
    expect(result.shippingCostCents).toBe(0);
  });
});

describe('calculateSellerEarnings', () => {
  it('takes 10% commission', () => {
    const result = calculateSellerEarnings(2000);
    expect(result.commissionCents).toBe(200);
    expect(result.walletCreditCents).toBe(1800);
  });

  it('rounds commission correctly for 1999 cents', () => {
    // 1999 * 0.10 = 199.9 → rounds to 200
    const result = calculateSellerEarnings(1999);
    expect(result.commissionCents).toBe(200);
    expect(result.walletCreditCents).toBe(1799);
  });

  it('handles small amounts', () => {
    const result = calculateSellerEarnings(100);
    expect(result.commissionCents).toBe(10);
    expect(result.walletCreditCents).toBe(90);
  });

  it('handles 1 cent item', () => {
    // 1 * 0.10 = 0.1 → rounds to 0
    const result = calculateSellerEarnings(1);
    expect(result.commissionCents).toBe(0);
    expect(result.walletCreditCents).toBe(1);
  });
});

describe('calculateOrderPricing', () => {
  it('combines buyer and seller sides correctly', () => {
    const result = calculateOrderPricing(2000, 350);
    // Buyer side
    expect(result.itemsTotalCents).toBe(2000);
    expect(result.shippingCostCents).toBe(350);
    expect(result.totalChargeCents).toBe(2350);
    // Seller side
    expect(result.commissionCents).toBe(200);
    expect(result.walletCreditCents).toBe(1800);
  });

  // Refund invariant: refundOrder() refunds total_amount_cents (split between card
  // and wallet). Dispute paths used to compute this as items + shipping. If a future
  // platform fee gets added to totalChargeCents without updating refundOrder's split
  // logic, disputes would silently over-refund. This assertion trips CI instead.
  it.each([
    [2000, 350],
    [1500, 0],
    [9999, 500],
    [1, 1],
  ])('total_amount_cents equals items_total + shipping (items=%i, shipping=%i)', (items, shipping) => {
    const result = calculateOrderPricing(items, shipping);
    expect(result.totalChargeCents).toBe(items + shipping);
  });
});

describe('calculateCheckoutPricing', () => {
  it('debits wallet up to total charge', () => {
    const result = calculateCheckoutPricing(2000, 350, 500);
    expect(result.walletDebitCents).toBe(500);
    expect(result.everypayChargeCents).toBe(1850);
  });

  it('handles zero wallet balance', () => {
    const result = calculateCheckoutPricing(2000, 350, 0);
    expect(result.walletDebitCents).toBe(0);
    expect(result.everypayChargeCents).toBe(2350);
  });

  it('caps wallet debit at total when wallet exceeds total', () => {
    const result = calculateCheckoutPricing(2000, 350, 10000);
    expect(result.walletDebitCents).toBe(2350);
    expect(result.everypayChargeCents).toBe(0);
  });

  it('wallet exactly equals total', () => {
    const result = calculateCheckoutPricing(2000, 350, 2350);
    expect(result.walletDebitCents).toBe(2350);
    expect(result.everypayChargeCents).toBe(0);
  });
});

describe('formatPrice', () => {
  it('formats with two decimal places', () => {
    expect(formatPrice(25.5)).toBe('25,50 €');
  });

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('0,00 €');
  });

  it('formats whole numbers', () => {
    expect(formatPrice(10)).toBe('10,00 €');
  });
});

describe('formatCentsToEuros', () => {
  it('converts cents to euros string', () => {
    expect(formatCentsToEuros(2550)).toBe('25,50');
  });

  it('handles single cent', () => {
    expect(formatCentsToEuros(1)).toBe('0,01');
  });

  it('handles zero', () => {
    expect(formatCentsToEuros(0)).toBe('0,00');
  });
});

describe('formatCentsToCurrency', () => {
  it('formats cents with euro symbol', () => {
    expect(formatCentsToCurrency(2550)).toBe('25,50 €');
  });

  it('formats zero cents', () => {
    expect(formatCentsToCurrency(0)).toBe('0,00 €');
  });
});

describe('getVatRate', () => {
  it('returns 0.21 for LV', () => {
    expect(getVatRate('LV')).toBe(0.21);
  });

  it('returns 0.21 for LT', () => {
    expect(getVatRate('LT')).toBe(0.21);
  });

  it('returns 0.24 for EE', () => {
    expect(getVatRate('EE')).toBe(0.24);
  });

  it('handles case-insensitive input', () => {
    expect(getVatRate('lv')).toBe(0.21);
    expect(getVatRate('ee')).toBe(0.24);
  });

  it('defaults to 0.21 for null', () => {
    expect(getVatRate(null)).toBe(0.21);
  });

  it('defaults to 0.21 for undefined', () => {
    expect(getVatRate(undefined)).toBe(0.21);
  });

  it('defaults to 0.21 for unknown country', () => {
    expect(getVatRate('DE')).toBe(0.21);
  });
});

describe('calculateVatSplit', () => {
  it('splits correctly for LV 21%', () => {
    const result = calculateVatSplit(12100, 0.21);
    expect(result.grossCents).toBe(12100);
    expect(result.netCents).toBe(10000);
    expect(result.vatCents).toBe(2100);
    expect(result.vatRate).toBe(0.21);
  });

  it('splits correctly for EE 24%', () => {
    const result = calculateVatSplit(12400, 0.24);
    expect(result.grossCents).toBe(12400);
    expect(result.netCents).toBe(10000);
    expect(result.vatCents).toBe(2400);
    expect(result.vatRate).toBe(0.24);
  });

  it('net + vat = gross always holds', () => {
    const result = calculateVatSplit(9999, 0.21);
    expect(result.netCents + result.vatCents).toBe(result.grossCents);
  });

  it('rounds correctly for non-clean splits', () => {
    // 1999 / 1.21 = 1652.066... → rounds to 1652
    const result = calculateVatSplit(1999, 0.21);
    expect(result.netCents).toBe(1652);
    expect(result.vatCents).toBe(347);
    expect(result.netCents + result.vatCents).toBe(1999);
  });
});
