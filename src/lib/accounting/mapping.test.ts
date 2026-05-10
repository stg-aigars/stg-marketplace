/**
 * Mapping compute() unit tests — VAT-inclusive arithmetic for order revenue.
 *
 * Per the seller agreement (src/app/[locale]/seller-terms/page.tsx §8) and
 * src/lib/services/pricing.ts:
 *   - The 10% commission on item price is GROSS (VAT included, not added on top)
 *   - The shipping fee buyer pays is GROSS (VAT included)
 *   - Seller's STG invoice = commission_gross + shipping_gross
 *   - VAT is decomposed inclusive: net = round(gross / (1 + rate)); vat = gross − net
 *
 * The seller wallet debit must equal the SUM of gross commission and gross
 * shipping — never larger. Adding VAT on top would silently overcharge the
 * seller and contradict the published terms.
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

function buildInput(
  counterparty: CounterpartyRow,
  vat_rate: number | null,
  payload: Record<string, unknown>
): ComputeInput {
  return { counterparty, vat_rate, payload, posting_date: '2027-01-15' };
}

describe('buildOrderRevenueLines — VAT-inclusive (matches seller terms §8)', () => {
  describe('O.1 — LV seller, 21%', () => {
    it('seller wallet debit equals commission_gross + shipping_gross (no VAT on top)', () => {
      const o1 = findMappingById('O.1');
      expect(o1).toBeDefined();
      const result = o1!.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2500, // €25.00 item
          shipping_value_cents: 350, // €3.50 shipping
          order_id: 'order_test',
          seller_id: 'seller_test',
          invoice_number: 'INV-2027-00001'
        })
      );
      const wallet = result.lines.find((l) => l.account_code === '5351');
      expect(wallet).toBeDefined();
      // Inclusive model: seller debit is exactly 10% of item + buyer-paid shipping.
      // 250 (commission gross, 10% of 2500) + 350 (shipping gross) = 600.
      expect(wallet!.debit_cents).toBe(600);
    });

    it('decomposes commission gross €2.50 into €2.07 net + €0.43 VAT', () => {
      const o1 = findMappingById('O.1');
      const result = o1!.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2500,
          shipping_value_cents: 0,
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

    it('decomposes shipping gross €3.50 into €2.89 net (per-line split)', () => {
      // Use item=2500 alongside shipping=350 so we can isolate the shipping
      // line's per-line decomposition (item_value_cents=0 would fail
      // requireNumber, and a zero-credit commission line would violate the
      // journal_lines CHECK).
      const o1 = findMappingById('O.1');
      const result = o1!.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2500,
          shipping_value_cents: 350,
          order_id: 'o',
          seller_id: 's',
          invoice_number: 'i'
        })
      );
      const shipping = result.lines.find((l) => l.account_code === '6310-S');
      // 350 gross / 1.21 ≈ 289.26 → 289 net (per-line). Per-line VAT = 350 − 289 = 61.
      expect(shipping!.credit_cents).toBe(289);
    });

    it('seller-terms worked example: €2.00 LV commission = €1.65 net + €0.35 VAT', () => {
      // Seller terms §8: "For a €2.00 commission in Latvia, that's €1.65 net plus €0.35 VAT"
      // €2.00 commission = 10% of €20.00 item.
      const o1 = findMappingById('O.1');
      const result = o1!.compute(
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
      expect(commission!.credit_cents).toBe(165); // €1.65
      expect(vat!.credit_cents).toBe(35); // €0.35
    });

    it('entry remains balanced: Σdebit = Σcredit', () => {
      const o1 = findMappingById('O.1');
      const result = o1!.compute(
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
  });

  describe('O.3 — LT B2C OSS, 21%', () => {
    it('seller wallet debit equals commission_gross + shipping_gross', () => {
      const o3 = findMappingById('O.3');
      const result = o3!.compute(
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
      expect(wallet!.debit_cents).toBe(800); // 250 + 550
    });

    it('routes VAT to OSS-LT (account 5711)', () => {
      const o3 = findMappingById('O.3');
      const result = o3!.compute(
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
      // Per-line decomposition (cleaner for invoice display):
      //   commission: 250 / 1.21 ≈ 206.6 → 207 net; vat = 43
      //   shipping:   550 / 1.21 ≈ 454.5 → 455 net; vat = 95
      // total vat = 43 + 95 = 138
      expect(vat).toBeDefined();
      expect(vat!.credit_cents).toBe(138);
    });
  });

  describe('O.5 — EE B2C OSS, 24%', () => {
    it('seller wallet debit equals commission_gross + shipping_gross', () => {
      const o5 = findMappingById('O.5');
      const result = o5!.compute(
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
      expect(wallet!.debit_cents).toBe(800);
    });

    it('routes VAT to OSS-EE (account 5712) at 24%', () => {
      const o5 = findMappingById('O.5');
      const result = o5!.compute(
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
      // Per-line decomposition (cleaner for invoice display):
      //   commission: 250 / 1.24 ≈ 201.6 → 202 net; vat = 48
      //   shipping:   550 / 1.24 ≈ 443.5 → 444 net; vat = 106
      // total vat = 48 + 106 = 154
      expect(vat).toBeDefined();
      expect(vat!.credit_cents).toBe(154);
    });
  });

  describe('O.2 — LT B2B reverse charge (no VAT line)', () => {
    it('seller wallet debit equals commission_gross + shipping_gross (vat_rate=0)', () => {
      const o2 = findMappingById('O.2');
      const result = o2!.compute(
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
      expect(wallet!.debit_cents).toBe(800);
    });

    it('credits commission and shipping at gross (no VAT to decompose)', () => {
      const o2 = findMappingById('O.2');
      const result = o2!.compute(
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
      const shipping = result.lines.find((l) => l.account_code === '6310-S');
      const vatLines = result.lines.filter(
        (l) => l.account_code.startsWith('5710') || l.account_code === '5711' || l.account_code === '5712'
      );
      expect(commission!.credit_cents).toBe(250);
      expect(shipping!.credit_cents).toBe(550);
      expect(vatLines).toHaveLength(0);
    });
  });

  describe('zero-credit line guard (journal_lines CHECK)', () => {
    it('omits 6310-S line when shipping_value_cents = 0', () => {
      // The journal_lines CHECK requires (debit=0) <> (credit=0) — exactly one
      // non-zero. A zero-shipping order would emit a credit=0 line on 6310-S
      // and be rejected by the DB trigger at insert time. The helper must
      // skip the line, mirroring buildVendorRcLines's rc_vat_cents > 0 guard.
      const o1 = findMappingById('O.1')!;
      const result = o1.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2500,
          shipping_value_cents: 0,
          order_id: 'o',
          seller_id: 's',
          invoice_number: 'i'
        })
      );
      const shippingLine = result.lines.find((l) => l.account_code === '6310-S');
      expect(shippingLine).toBeUndefined();
      // Every emitted line still satisfies the CHECK invariant.
      for (const line of result.lines) {
        expect((line.debit_cents === 0) !== (line.credit_cents === 0)).toBe(true);
      }
      // Entry remains balanced.
      const debits = result.lines.reduce((s, l) => s + l.debit_cents, 0);
      const credits = result.lines.reduce((s, l) => s + l.credit_cents, 0);
      expect(debits).toBe(credits);
      // Wallet debit = commission_gross only (250).
      const wallet = result.lines.find((l) => l.account_code === '5351')!;
      expect(wallet.debit_cents).toBe(250);
    });
  });

  describe('rounding invariant', () => {
    it('vat = gross − net for any combination (no off-by-one)', () => {
      const cases = [
        { item: 1999, ship: 0, rate: 0.21 }, // weird item price
        { item: 2500, ship: 350, rate: 0.21 },
        { item: 12345, ship: 0, rate: 0.24 },
        { item: 100, ship: 100, rate: 0.21 } // tiny amounts
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
        const wallet = result.lines.find((l) => l.account_code === '5351')!;
        const credits = result.lines.reduce((sum, l) => sum + l.credit_cents, 0);
        // Wallet debit = sum of all credits (balanced entry)
        expect(wallet.debit_cents).toBe(credits);
        // Wallet debit = commission_gross + shipping_gross (inclusive promise).
        // Use roundHalfUpCents (production rounding) — Math.round agrees on
        // these inputs but isn't a contract guarantee.
        const expectedGross = roundHalfUpCents(c.item * 0.1) + c.ship;
        expect(wallet.debit_cents).toBe(expectedGross);
      }
    });
  });
});
