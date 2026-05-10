/**
 * Mapping compute() unit tests — commission-invoice slice for order revenue.
 *
 * Per the seller agreement (src/app/[locale]/seller-terms/page.tsx §3 + §8)
 * and src/lib/services/pricing.ts:
 *   - Seller wallet credit = item price − 10% commission. Shipping does NOT
 *     pass through the wallet — buyer-paid shipping flows separately to STG.
 *   - The 10% commission is GROSS (VAT included, not added on top).
 *   - VAT decomposes inclusive: net = round(gross / (1 + rate)); vat = gross − net.
 *
 * SCOPE OF THE SLICE: this PR ships only the commission-invoice slice. The
 * journal entry produced here debits the wallet for the commission gross and
 * credits commission revenue + commission VAT. Shipping logistics revenue
 * (6310-S), shipping VAT, suspense release, Unisend accrual, and the wallet's
 * item-proceeds credit are all PR #5 lifecycle integration concerns.
 *
 * Tests assert: wallet debit = commission_gross only; commission VAT is
 * decomposed inclusive; B2B RC produces no VAT line; sub-cent / zero amounts
 * never violate the journal_lines CHECK `(debit=0) <> (credit=0)`.
 */

import { describe, it, expect } from 'vitest';

import { roundHalfUpCents } from './computer';
import { findMappingById } from './mapping';
import type { ComputeInput, CounterpartyRow } from './types';

function lvSeller(): CounterpartyRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    type: 'seller',
    user_id: null,
    full_name: 'LV Seller',
    country: 'LV',
    tax_status: 'private',
    tin: null,
    vat_number: null,
    vies_verified_at: null,
    iban: null,
    iban_validated_at: null,
    legal_compliance_status: 'ok',
    kyc_status: 'not_required',
    kyc_verified_at: null,
    vendor_code: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };
}

function ltSellerB2C(): CounterpartyRow {
  return { ...lvSeller(), id: '33333333-3333-3333-3333-333333333333', country: 'LT' };
}

function ltSellerB2B(): CounterpartyRow {
  return {
    ...lvSeller(),
    id: '22222222-2222-2222-2222-222222222222',
    country: 'LT',
    tax_status: 'vat_registered',
    vat_number: 'LT123456789',
    vies_verified_at: '2026-01-01T00:00:00Z'
  };
}

function eeSellerB2C(): CounterpartyRow {
  return { ...lvSeller(), id: '99999999-9999-9999-9999-999999999999', country: 'EE' };
}

function eeSellerB2B(): CounterpartyRow {
  return {
    ...lvSeller(),
    id: '88888888-8888-8888-8888-888888888888',
    country: 'EE',
    tax_status: 'vat_registered',
    vat_number: 'EE100247025',
    vies_verified_at: '2026-01-01T00:00:00Z'
  };
}

function buildInput(
  counterparty: CounterpartyRow,
  vat_rate: number | null,
  payload: Record<string, unknown>
): ComputeInput {
  return { counterparty, vat_rate, payload, posting_date: '2027-01-15' };
}

describe('buildOrderRevenueLines — commission-invoice slice', () => {
  describe('O.1 — LV seller, 21%', () => {
    it('seller wallet debit equals commission_gross — shipping never touches 5351', () => {
      const o1 = findMappingById('O.1')!;
      const result = o1.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2500, // €25.00 item
          shipping_value_cents: 350, // €3.50 shipping (does not affect wallet)
          order_id: 'order_test',
          seller_id: 'seller_test',
          invoice_number: 'INV-2027-00001'
        })
      );
      const wallet = result.lines.find((l) => l.account_code === '5351');
      // 10% of €25.00 = €2.50 commission. Wallet sees only commission.
      expect(wallet!.debit_cents).toBe(250);
      // 6310-S (shipping revenue) is NOT in this slice — recognized in PR #5.
      expect(result.lines.find((l) => l.account_code === '6310-S')).toBeUndefined();
    });

    it('decomposes commission gross €2.50 into €2.07 net + €0.43 VAT', () => {
      const o1 = findMappingById('O.1')!;
      const result = o1.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2500,
          shipping_value_cents: 350,
          order_id: 'o',
          seller_id: 's',
          invoice_number: 'i'
        })
      );
      const commission = result.lines.find((l) => l.account_code === '6310-C');
      const vat = result.lines.find((l) => l.account_code === '5710-LV-OUT');
      expect(commission!.credit_cents).toBe(207); // 250 / 1.21 ≈ 206.6 → 207
      expect(vat!.credit_cents).toBe(43); // 250 − 207
    });

    it('seller-terms worked example: €2.00 LV commission = €1.65 net + €0.35 VAT', () => {
      // Seller terms §8: "For a €2.00 commission in Latvia, that's €1.65 net plus €0.35 VAT"
      // €2.00 commission = 10% of €20.00 item.
      const o1 = findMappingById('O.1')!;
      const result = o1.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2000,
          shipping_value_cents: 0,
          order_id: 'o',
          seller_id: 's',
          invoice_number: 'i'
        })
      );
      const commission = result.lines.find((l) => l.account_code === '6310-C');
      const vat = result.lines.find((l) => l.account_code === '5710-LV-OUT');
      expect(commission!.credit_cents).toBe(165);
      expect(vat!.credit_cents).toBe(35);
    });

    it('entry is balanced: Σdebit = Σcredit', () => {
      const o1 = findMappingById('O.1')!;
      const result = o1.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2500,
          shipping_value_cents: 350,
          order_id: 'o',
          seller_id: 's',
          invoice_number: 'i'
        })
      );
      const debits = result.lines.reduce((sum, l) => sum + l.debit_cents, 0);
      const credits = result.lines.reduce((sum, l) => sum + l.credit_cents, 0);
      expect(debits).toBe(credits);
    });

    it('exposes shipping_value_cents and shipping_vat_cents in posting_context for PR #5', () => {
      const o1 = findMappingById('O.1')!;
      const result = o1.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2500,
          shipping_value_cents: 350,
          order_id: 'o',
          seller_id: 's',
          invoice_number: 'i'
        })
      );
      // Shipping economics surface in posting_context so the PR #5 shipping
      // invoice slice and audit trail can read them, even though they don't
      // produce journal lines in this slice.
      expect(result.posting_context_extras.shipping_value_cents).toBe(350);
      // 350 / 1.21 ≈ 289.26 → 289 net; vat = 61
      expect(result.posting_context_extras.shipping_vat_cents).toBe(61);
      expect(result.posting_context_extras.commission_vat_cents).toBe(43);
      expect(result.posting_context_extras.vat_cents).toBe(43); // commission VAT only
    });
  });

  describe('O.3 — LT B2C OSS, 21%', () => {
    it('seller wallet debit equals commission_gross only', () => {
      const o3 = findMappingById('O.3')!;
      const result = o3.compute(
        buildInput(ltSellerB2C(), 0.21, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o',
          seller_id: 's',
          invoice_number: 'i',
          consumption_ms: 'LT'
        })
      );
      const wallet = result.lines.find((l) => l.account_code === '5351');
      expect(wallet!.debit_cents).toBe(250);
    });

    it('routes commission VAT to OSS-LT (account 5711), no shipping VAT', () => {
      const o3 = findMappingById('O.3')!;
      const result = o3.compute(
        buildInput(ltSellerB2C(), 0.21, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o',
          seller_id: 's',
          invoice_number: 'i',
          consumption_ms: 'LT'
        })
      );
      const vat = result.lines.find((l) => l.account_code === '5711');
      // Commission only: 250 / 1.21 ≈ 206.6 → 207 net; vat = 43.
      // Shipping VAT (95) goes to PR #5's shipping slice, not here.
      expect(vat!.credit_cents).toBe(43);
    });
  });

  describe('O.5 — EE B2C OSS, 24%', () => {
    it('seller wallet debit equals commission_gross only', () => {
      const o5 = findMappingById('O.5')!;
      const result = o5.compute(
        buildInput(eeSellerB2C(), 0.24, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o',
          seller_id: 's',
          invoice_number: 'i',
          consumption_ms: 'EE'
        })
      );
      const wallet = result.lines.find((l) => l.account_code === '5351');
      expect(wallet!.debit_cents).toBe(250);
    });

    it('routes commission VAT to OSS-EE (5712) at 24%', () => {
      const o5 = findMappingById('O.5')!;
      const result = o5.compute(
        buildInput(eeSellerB2C(), 0.24, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o',
          seller_id: 's',
          invoice_number: 'i',
          consumption_ms: 'EE'
        })
      );
      const vat = result.lines.find((l) => l.account_code === '5712');
      // 250 / 1.24 ≈ 201.6 → 202 net; vat = 48
      expect(vat!.credit_cents).toBe(48);
    });
  });

  describe('O.2 — LT B2B reverse charge (no VAT line)', () => {
    it('seller wallet debit equals commission_gross (vat_rate=0)', () => {
      const o2 = findMappingById('O.2')!;
      const result = o2.compute(
        buildInput(ltSellerB2B(), 0, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o',
          seller_id: 's',
          seller_vat_number: 'LT123456789',
          vies_verified_at: '2026-01-01T00:00:00Z',
          invoice_number: 'i'
        })
      );
      const wallet = result.lines.find((l) => l.account_code === '5351');
      expect(wallet!.debit_cents).toBe(250);
    });

    it('credits commission at gross with no VAT line, no shipping line', () => {
      const o2 = findMappingById('O.2')!;
      const result = o2.compute(
        buildInput(ltSellerB2B(), 0, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o',
          seller_id: 's',
          seller_vat_number: 'LT123456789',
          vies_verified_at: '2026-01-01T00:00:00Z',
          invoice_number: 'i'
        })
      );
      const commission = result.lines.find((l) => l.account_code === '6310-C');
      expect(commission!.credit_cents).toBe(250);
      expect(commission!.vat_country).toBe('LT');
      expect(result.lines.find((l) => l.account_code === '6310-S')).toBeUndefined();
      const vatLines = result.lines.filter(
        (l) => l.account_code.startsWith('5710') || l.account_code === '5711' || l.account_code === '5712'
      );
      expect(vatLines).toHaveLength(0);
    });
  });

  describe('O.4 — EE B2B reverse charge (no VAT line)', () => {
    it('seller wallet debit equals commission_gross (vat_rate=0)', () => {
      const o4 = findMappingById('O.4')!;
      const result = o4.compute(
        buildInput(eeSellerB2B(), 0, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o',
          seller_id: 's',
          seller_vat_number: 'EE100247025',
          vies_verified_at: '2026-01-01T00:00:00Z',
          invoice_number: 'i'
        })
      );
      const wallet = result.lines.find((l) => l.account_code === '5351');
      expect(wallet!.debit_cents).toBe(250);
    });

    it('credits commission at gross with EE country tag, no VAT line', () => {
      const o4 = findMappingById('O.4')!;
      const result = o4.compute(
        buildInput(eeSellerB2B(), 0, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o',
          seller_id: 's',
          seller_vat_number: 'EE100247025',
          vies_verified_at: '2026-01-01T00:00:00Z',
          invoice_number: 'i'
        })
      );
      const commission = result.lines.find((l) => l.account_code === '6310-C');
      expect(commission!.credit_cents).toBe(250);
      expect(commission!.vat_country).toBe('EE');
      const vatLines = result.lines.filter(
        (l) => l.account_code.startsWith('5710') || l.account_code === '5711' || l.account_code === '5712'
      );
      expect(vatLines).toHaveLength(0);
    });
  });

  describe('journal_lines CHECK invariants', () => {
    it('every emitted line has exactly one of debit/credit non-zero', () => {
      // Cover several payload shapes incl. zero shipping (which used to
      // produce a zero-credit 6310-S line — now eliminated entirely since
      // shipping is no longer in this slice).
      const cases = [
        { item: 2500, ship: 0, rate: 0.21 },
        { item: 2500, ship: 350, rate: 0.21 },
        { item: 12345, ship: 0, rate: 0.24 },
        { item: 100, ship: 100, rate: 0.21 } // tiny — tests sub-cent guards
      ];
      const o1 = findMappingById('O.1')!;
      for (const c of cases) {
        const result = o1.compute(
          buildInput(lvSeller(), c.rate, {
            item_value_cents: c.item,
            shipping_value_cents: c.ship,
            order_id: 'o',
            seller_id: 's',
            invoice_number: 'i'
          })
        );
        for (const line of result.lines) {
          expect((line.debit_cents === 0) !== (line.credit_cents === 0)).toBe(true);
        }
      }
    });

    it('wallet debit = commission_gross across rates and amounts (no shipping leakage)', () => {
      const cases = [
        { item: 1999, rate: 0.21 },
        { item: 2500, rate: 0.21 },
        { item: 12345, rate: 0.24 },
        { item: 100, rate: 0.21 }
      ];
      const o1 = findMappingById('O.1')!;
      for (const c of cases) {
        const result = o1.compute(
          buildInput(lvSeller(), c.rate, {
            item_value_cents: c.item,
            shipping_value_cents: 999, // arbitrary; should NOT affect wallet
            order_id: 'o',
            seller_id: 's',
            invoice_number: 'i'
          })
        );
        const wallet = result.lines.find((l) => l.account_code === '5351')!;
        expect(wallet.debit_cents).toBe(roundHalfUpCents(c.item * 0.1));
        // Balanced
        const debits = result.lines.reduce((s, l) => s + l.debit_cents, 0);
        const credits = result.lines.reduce((s, l) => s + l.credit_cents, 0);
        expect(debits).toBe(credits);
      }
    });
  });
});
