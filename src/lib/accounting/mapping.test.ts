/**
 * Mapping compute() unit tests — full O.x completion entry (PR #5 v1.4).
 *
 * Per `docs/legal_audit/accountant-completion-entry-signoff.md` v1.4 (12 May 2026):
 *   - Completion entry is 5 lines (4 for B2B RC):
 *       Dr 5590 gross_cart / Cr 5351 seller_net /
 *       Cr 6310-C commission_net / Cr 6310-S shipping_net /
 *       Cr {vat_account} vat_amount   (omitted when vat_account=null for B2B RC)
 *   - seller_net = item_value − commission_gross
 *   - commission/shipping decomposed VAT-inclusive: net = round(gross / (1+rate));
 *     vat = gross − net (DERIVED, never independently computed).
 *   - Per-order Unisend accrual dropped in v1.4 (was Dr 7720 + Cr 5410-UN
 *     under v1.3 STG-as-principal model). Cost recognized at I.1 invoice.
 *
 * Tests assert: 5-line entry shape (4 for B2B RC); wallet credit equals
 * seller_net (was wallet debit at commission_gross under PR #2's commission-
 * only slice); VAT is the sum of commission_vat + shipping_vat; balance
 * holds; sub-cent / zero amounts never violate journal_lines CHECK.
 */

import { describe, it, expect } from 'vitest';

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

describe('buildOrderRevenueLines — full v1.4 completion entry', () => {
  describe('O.1 — LV seller, 21%', () => {
    it('produces 5-line entry: Dr 5590 + Cr 5351 + Cr 6310-C + Cr 6310-S + Cr 5710-LV-OUT', () => {
      // €25 item + €3.50 shipping = €28.50 gross_cart.
      // commission_gross = 250¢; commission_net = round(250/1.21) = 207¢; commission_vat = 43¢.
      // shipping_net = round(350/1.21) = 289¢; shipping_vat = 61¢.
      // seller_net = 2500 − 250 = 2250¢. vat_amount = 43 + 61 = 104¢.
      const o1 = findMappingById('O.1')!;
      const result = o1.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2500,
          shipping_value_cents: 350,
          order_id: 'order_test',
          seller_id: 'seller_test',
          invoice_number: 'INV-2027-00001'
        })
      );
      expect(result.lines).toHaveLength(5);
      const suspense = result.lines.find((l) => l.account_code === '5590')!;
      expect(suspense.debit_cents).toBe(2850); // gross_cart
      const wallet = result.lines.find((l) => l.account_code === '5351')!;
      expect(wallet.credit_cents).toBe(2250); // seller_net
      const commission = result.lines.find((l) => l.account_code === '6310-C')!;
      expect(commission.credit_cents).toBe(207);
      const shipping = result.lines.find((l) => l.account_code === '6310-S')!;
      expect(shipping.credit_cents).toBe(289);
      const vat = result.lines.find((l) => l.account_code === '5710-LV-OUT')!;
      expect(vat.credit_cents).toBe(104); // commission_vat (43) + shipping_vat (61)
    });

    it('VAT derivation uses gross − net (invariant from accountant rounding warning)', () => {
      // Verify that for every grossy line, gross == net + vat (no sub-cent residue).
      const o1 = findMappingById('O.1')!;
      const result = o1.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2500,
          shipping_value_cents: 350,
          order_id: 'o', seller_id: 's', invoice_number: 'i'
        })
      );
      // commission: gross 250 = net 207 + vat 43 ✓
      expect(result.posting_context_extras.commission_vat_cents).toBe(43);
      // shipping: gross 350 = net 289 + vat 61 ✓
      expect(result.posting_context_extras.shipping_vat_cents).toBe(61);
      // total VAT line = sum of derived vats
      expect(result.posting_context_extras.vat_cents).toBe(104);
    });

    it('seller-terms worked example: €2.00 LV commission = €1.65 net + €0.35 VAT', () => {
      // Seller terms §8: "For a €2.00 commission in Latvia, that's €1.65 net plus €0.35 VAT"
      // €2.00 commission = 10% of €20.00 item; zero shipping for this test.
      const o1 = findMappingById('O.1')!;
      const result = o1.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2000,
          shipping_value_cents: 0,
          order_id: 'o', seller_id: 's', invoice_number: 'i'
        })
      );
      const commission = result.lines.find((l) => l.account_code === '6310-C')!;
      expect(commission.credit_cents).toBe(165);
      const vat = result.lines.find((l) => l.account_code === '5710-LV-OUT')!;
      expect(vat.credit_cents).toBe(35); // commission VAT only when shipping=0
      // No 6310-S line emitted when shipping_value=0 (zero-amount line guard).
      expect(result.lines.find((l) => l.account_code === '6310-S')).toBeUndefined();
    });

    it('entry is balanced: Σdebit = Σcredit', () => {
      const o1 = findMappingById('O.1')!;
      const result = o1.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 2500,
          shipping_value_cents: 350,
          order_id: 'o', seller_id: 's', invoice_number: 'i'
        })
      );
      const debits = result.lines.reduce((sum, l) => sum + l.debit_cents, 0);
      const credits = result.lines.reduce((sum, l) => sum + l.credit_cents, 0);
      expect(debits).toBe(credits);
      expect(debits).toBe(2850); // = gross_cart
    });

    it('seller_net uses item_value − commission_gross (Unisend cost not deducted per v1.4)', () => {
      // Under v1.3 seller_net would have been item_value − commission_gross − unisend_cost.
      // v1.4 drops the unisend deduction (cost recognized at I.1 invoice receipt).
      const o1 = findMappingById('O.1')!;
      const result = o1.compute(
        buildInput(lvSeller(), 0.21, {
          item_value_cents: 10000, // €100 item
          shipping_value_cents: 500, // €5 shipping
          order_id: 'o', seller_id: 's', invoice_number: 'i'
        })
      );
      const wallet = result.lines.find((l) => l.account_code === '5351')!;
      // commission_gross = 1000; seller_net = 10000 - 1000 = 9000.
      expect(wallet.credit_cents).toBe(9000);
      expect(result.posting_context_extras.seller_net_cents).toBe(9000);
    });
  });

  describe('O.3 — LT B2C OSS, 21%', () => {
    it('routes VAT to OSS-LT (5711); 5-line entry shape preserved', () => {
      const o3 = findMappingById('O.3')!;
      const result = o3.compute(
        buildInput(ltSellerB2C(), 0.21, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o', seller_id: 's', invoice_number: 'i', consumption_ms: 'LT'
        })
      );
      expect(result.lines).toHaveLength(5);
      // commission_vat = 43, shipping_vat = round(550/1.21)=455 net, vat = 95.
      // Total VAT = 43 + 95 = 138.
      const vat = result.lines.find((l) => l.account_code === '5711')!;
      expect(vat.credit_cents).toBe(138);
      // No 5710-LV-OUT — OSS routes to OSS-LT clearing instead.
      expect(result.lines.find((l) => l.account_code === '5710-LV-OUT')).toBeUndefined();
    });
  });

  describe('O.5 — EE B2C OSS, 24%', () => {
    it('routes VAT to OSS-EE (5712) at 24%', () => {
      const o5 = findMappingById('O.5')!;
      const result = o5.compute(
        buildInput(eeSellerB2C(), 0.24, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o', seller_id: 's', invoice_number: 'i', consumption_ms: 'EE'
        })
      );
      expect(result.lines).toHaveLength(5);
      // commission: 250 / 1.24 ≈ 201.6 → 202 net; vat = 48.
      // shipping: 550 / 1.24 ≈ 443.5 → 444 net; vat = 106.
      // Total VAT = 48 + 106 = 154.
      const vat = result.lines.find((l) => l.account_code === '5712')!;
      expect(vat.credit_cents).toBe(154);
    });
  });

  describe('O.2 — LT B2B reverse charge (4-line entry, no VAT line)', () => {
    it('produces 4 lines: Dr 5590 + Cr 5351 + Cr 6310-C + Cr 6310-S; no VAT', () => {
      const o2 = findMappingById('O.2')!;
      const result = o2.compute(
        buildInput(ltSellerB2B(), 0, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o', seller_id: 's',
          seller_vat_number: 'LT123456789',
          vies_verified_at: '2026-01-01T00:00:00Z',
          invoice_number: 'i'
        })
      );
      expect(result.lines).toHaveLength(4); // No VAT line under B2B RC
      const suspense = result.lines.find((l) => l.account_code === '5590')!;
      expect(suspense.debit_cents).toBe(3050); // gross_cart = 2500 + 550
      const wallet = result.lines.find((l) => l.account_code === '5351')!;
      expect(wallet.credit_cents).toBe(2250); // seller_net = 2500 − 250
      const commission = result.lines.find((l) => l.account_code === '6310-C')!;
      expect(commission.credit_cents).toBe(250); // gross == net at vat_rate=0
      expect(commission.vat_country).toBe('LT');
      const shipping = result.lines.find((l) => l.account_code === '6310-S')!;
      expect(shipping.credit_cents).toBe(550); // gross == net
      expect(shipping.vat_country).toBe('LT');
      const vatLines = result.lines.filter(
        (l) => l.account_code.startsWith('5710') || l.account_code === '5711' || l.account_code === '5712'
      );
      expect(vatLines).toHaveLength(0);
    });

    it('balanced under B2B RC: Σ Dr = Σ Cr = gross_cart', () => {
      const o2 = findMappingById('O.2')!;
      const result = o2.compute(
        buildInput(ltSellerB2B(), 0, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o', seller_id: 's',
          seller_vat_number: 'LT123456789',
          vies_verified_at: '2026-01-01T00:00:00Z',
          invoice_number: 'i'
        })
      );
      const debits = result.lines.reduce((s, l) => s + l.debit_cents, 0);
      const credits = result.lines.reduce((s, l) => s + l.credit_cents, 0);
      expect(debits).toBe(credits);
      expect(debits).toBe(3050);
    });
  });

  describe('O.4 — EE B2B reverse charge (4-line entry, no VAT line)', () => {
    it('produces 4 lines with EE country tag, no VAT', () => {
      const o4 = findMappingById('O.4')!;
      const result = o4.compute(
        buildInput(eeSellerB2B(), 0, {
          item_value_cents: 2500,
          shipping_value_cents: 550,
          order_id: 'o', seller_id: 's',
          seller_vat_number: 'EE100247025',
          vies_verified_at: '2026-01-01T00:00:00Z',
          invoice_number: 'i'
        })
      );
      expect(result.lines).toHaveLength(4);
      const commission = result.lines.find((l) => l.account_code === '6310-C')!;
      expect(commission.credit_cents).toBe(250);
      expect(commission.vat_country).toBe('EE');
      const shipping = result.lines.find((l) => l.account_code === '6310-S')!;
      expect(shipping.vat_country).toBe('EE');
      const vatLines = result.lines.filter(
        (l) => l.account_code.startsWith('5710') || l.account_code === '5711' || l.account_code === '5712'
      );
      expect(vatLines).toHaveLength(0);
    });
  });

  describe('journal_lines CHECK invariants', () => {
    it('every emitted line has exactly one of debit/credit non-zero', () => {
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
            order_id: 'o', seller_id: 's', invoice_number: 'i'
          })
        );
        for (const line of result.lines) {
          expect((line.debit_cents === 0) !== (line.credit_cents === 0)).toBe(true);
        }
      }
    });

    it('balanced across rates and amounts; suspense debit equals gross_cart', () => {
      const cases = [
        { item: 1999, ship: 0, rate: 0.21 },
        { item: 2500, ship: 350, rate: 0.21 },
        { item: 12345, ship: 999, rate: 0.24 },
        { item: 100, ship: 100, rate: 0.21 }
      ];
      const o1 = findMappingById('O.1')!;
      for (const c of cases) {
        const result = o1.compute(
          buildInput(lvSeller(), c.rate, {
            item_value_cents: c.item,
            shipping_value_cents: c.ship,
            order_id: 'o', seller_id: 's', invoice_number: 'i'
          })
        );
        const debits = result.lines.reduce((s, l) => s + l.debit_cents, 0);
        const credits = result.lines.reduce((s, l) => s + l.credit_cents, 0);
        expect(debits).toBe(credits);
        const expected_gross_cart = c.item + c.ship;
        expect(debits).toBe(expected_gross_cart);
        const suspense = result.lines.find((l) => l.account_code === '5590')!;
        expect(suspense.debit_cents).toBe(expected_gross_cart);
      }
    });
  });
});

// ===========================================================================
// O.9 — Partial refund (proportional split; PR #5 commit 4)
//
// Math per docs/legal_audit/accountant-completion-entry-signoff.md v1.2:
//   partial_commission_gross = round_half_up(original_commission_gross × refund_item / original_item)
//   partial_commission_net   = round_half_up(partial_commission_gross / (1 + vat_rate))
//   partial_commission_vat   = partial_commission_gross − partial_commission_net
// Lines: Dr 6310-C net + Dr {vat_account} vat + Cr 5351 gross. Σ Dr = Σ Cr.
// ===========================================================================

describe('O.9 — partial refund proportional split (VAT-inclusive)', () => {
  it('€33.33 partial of a €100 LV order — one-third VAT recompute', () => {
    // Original: item €100, commission gross €10 (10% of item), 21% LV VAT.
    // Partial refund: €33.33 of item only.
    // Ratio: 33.33/100 = 0.3333 → commission_gross 333¢ → net 275¢ + vat 58¢.
    const o9 = findMappingById('O.9')!;
    const result = o9.compute(
      buildInput(lvSeller(), null, {
        order_id: 'order_test',
        original_invoice_number: 'STG-2027-00001',
        credit_note_number: 'STG-CN-2027-00001',
        original_item_value_cents: 10000,
        original_commission_gross_cents: 1000,
        original_shipping_value_cents: 0,
        refund_item_cents: 3333,
        refund_shipping_cents: 0,
        vat_rate: 0.21,
        vat_country: 'LV',
        vat_account: '5710-LV-OUT'
      })
    );
    const debit_commission = result.lines.find((l) => l.account_code === '6310-C')!;
    const debit_vat = result.lines.find((l) => l.account_code === '5710-LV-OUT')!;
    const credit_wallet = result.lines.find((l) => l.account_code === '5351')!;
    expect(debit_commission.debit_cents).toBe(275);
    expect(debit_vat.debit_cents).toBe(58);
    expect(credit_wallet.credit_cents).toBe(333);
    // No 6310-S line — shipping not refunded.
    expect(result.lines.find((l) => l.account_code === '6310-S')).toBeUndefined();
    // Balanced.
    const debits = result.lines.reduce((s, l) => s + l.debit_cents, 0);
    const credits = result.lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(debits).toBe(credits);
    expect(debits).toBe(333);
  });

  it('€50 partial of a €105 LT B2C OSS order — cross-rate VAT routes to 5711', () => {
    // Original: item €100 + shipping €5 = €105 cart, commission €10 gross,
    // 21% LT VAT (LT B2C OSS routing). Partial refund: €50 of item; buyer keeps shipping.
    // Ratio: 50/100 = 0.5 → commission_gross 500¢ → net 413¢ + vat 87¢.
    // VAT account is 5711 (OSS-LT) not 5710-LV-OUT.
    const o9 = findMappingById('O.9')!;
    const result = o9.compute(
      buildInput(ltSellerB2C(), null, {
        order_id: 'order_test',
        original_invoice_number: 'STG-2027-00002',
        credit_note_number: 'STG-CN-2027-00002',
        original_item_value_cents: 10000,
        original_commission_gross_cents: 1000,
        original_shipping_value_cents: 500,
        refund_item_cents: 5000,
        refund_shipping_cents: 0,
        vat_rate: 0.21,
        vat_country: 'LT',
        vat_account: '5711'
      })
    );
    const debit_commission = result.lines.find((l) => l.account_code === '6310-C')!;
    const debit_vat = result.lines.find((l) => l.account_code === '5711')!;
    const credit_wallet = result.lines.find((l) => l.account_code === '5351')!;
    expect(debit_commission.debit_cents).toBe(413);
    expect(debit_vat.debit_cents).toBe(87);
    expect(credit_wallet.credit_cents).toBe(500);
    // No 6310-S — shipping not refunded.
    expect(result.lines.find((l) => l.account_code === '6310-S')).toBeUndefined();
    // No 5710-LV-OUT — OSS routing does not use the LV-domestic VAT account.
    expect(result.lines.find((l) => l.account_code === '5710-LV-OUT')).toBeUndefined();
    // Balanced.
    const debits = result.lines.reduce((s, l) => s + l.debit_cents, 0);
    const credits = result.lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(debits).toBe(credits);
    expect(debits).toBe(500);
  });

  it('€1.00 minimum-partial edge case — integer-cents discipline preserved', () => {
    // Original: item €100, commission €10 gross, 21% LV VAT.
    // Partial refund: €1.00 (= 100 cents).
    // Ratio: 100/10000 = 0.01 → commission_gross 10¢ → net 8¢ + vat 2¢.
    const o9 = findMappingById('O.9')!;
    const result = o9.compute(
      buildInput(lvSeller(), null, {
        order_id: 'order_test',
        original_invoice_number: 'STG-2027-00003',
        credit_note_number: 'STG-CN-2027-00003',
        original_item_value_cents: 10000,
        original_commission_gross_cents: 1000,
        original_shipping_value_cents: 0,
        refund_item_cents: 100,
        refund_shipping_cents: 0,
        vat_rate: 0.21,
        vat_country: 'LV',
        vat_account: '5710-LV-OUT'
      })
    );
    const debit_commission = result.lines.find((l) => l.account_code === '6310-C')!;
    const debit_vat = result.lines.find((l) => l.account_code === '5710-LV-OUT')!;
    const credit_wallet = result.lines.find((l) => l.account_code === '5351')!;
    expect(debit_commission.debit_cents).toBe(8);
    expect(debit_vat.debit_cents).toBe(2);
    expect(credit_wallet.credit_cents).toBe(10);
    // No zero-amount lines (CHECK constraint on journal_lines).
    for (const line of result.lines) {
      expect((line.debit_cents === 0) !== (line.credit_cents === 0)).toBe(true);
    }
    // Balanced.
    const debits = result.lines.reduce((s, l) => s + l.debit_cents, 0);
    const credits = result.lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(debits).toBe(credits);
  });

  it('€100 of €100 — full amount via partial path matches O.7 happy-path math', () => {
    // 100% partial: ratio = 1.0 → commission_gross = original_commission_gross.
    // Should produce the same line amounts as a full refund's reversal of
    // the original O.x entry — the equivalence O.7 vs O.9-with-full-ratio.
    const o9 = findMappingById('O.9')!;
    const result = o9.compute(
      buildInput(lvSeller(), null, {
        order_id: 'order_test',
        original_invoice_number: 'STG-2027-00004',
        credit_note_number: 'STG-CN-2027-00004',
        original_item_value_cents: 10000,
        original_commission_gross_cents: 1000,
        original_shipping_value_cents: 0,
        refund_item_cents: 10000,
        refund_shipping_cents: 0,
        vat_rate: 0.21,
        vat_country: 'LV',
        vat_account: '5710-LV-OUT'
      })
    );
    const debit_commission = result.lines.find((l) => l.account_code === '6310-C')!;
    const debit_vat = result.lines.find((l) => l.account_code === '5710-LV-OUT')!;
    const credit_wallet = result.lines.find((l) => l.account_code === '5351')!;
    // 1000¢ gross → splitInclusiveVat(1000, 0.21) → net=826, vat=174
    expect(debit_commission.debit_cents).toBe(826);
    expect(debit_vat.debit_cents).toBe(174);
    expect(credit_wallet.credit_cents).toBe(1000);
    // Balanced.
    const debits = result.lines.reduce((s, l) => s + l.debit_cents, 0);
    const credits = result.lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(debits).toBe(credits);
    expect(debits).toBe(1000);
  });

  it('B2B reverse-charge (O.2/O.4 origin) — no VAT line; commission gross = net', () => {
    // For an LT B2B RC original (vat_rate = 0), gross = net and vat = 0.
    // The vat_account is null so no VAT line emits. Lines: Dr 6310-C net, Cr 5351 gross.
    const o9 = findMappingById('O.9')!;
    const result = o9.compute(
      buildInput(ltSellerB2B(), null, {
        order_id: 'order_test',
        original_invoice_number: 'STG-2027-00005',
        credit_note_number: 'STG-CN-2027-00005',
        original_item_value_cents: 10000,
        original_commission_gross_cents: 1000,
        original_shipping_value_cents: 0,
        refund_item_cents: 5000,
        refund_shipping_cents: 0,
        vat_rate: 0,
        vat_country: 'LT',
        vat_account: null
      })
    );
    const debit_commission = result.lines.find((l) => l.account_code === '6310-C')!;
    const credit_wallet = result.lines.find((l) => l.account_code === '5351')!;
    expect(debit_commission.debit_cents).toBe(500);
    expect(credit_wallet.credit_cents).toBe(500);
    // No VAT line at all.
    expect(result.lines.length).toBe(2);
    // Balanced.
    const debits = result.lines.reduce((s, l) => s + l.debit_cents, 0);
    const credits = result.lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(debits).toBe(credits);
  });

  it('rejects refund_item_cents > original_item_value_cents', () => {
    const o9 = findMappingById('O.9')!;
    expect(() => o9.compute(
      buildInput(lvSeller(), null, {
        order_id: 'o', original_invoice_number: 'i', credit_note_number: 'c',
        original_item_value_cents: 1000,
        original_commission_gross_cents: 100,
        original_shipping_value_cents: 0,
        refund_item_cents: 2000,  // > original
        refund_shipping_cents: 0,
        vat_rate: 0.21,
        vat_country: 'LV',
        vat_account: '5710-LV-OUT'
      })
    )).toThrow(/refund_item_cents.*cannot exceed/);
  });
});

// =============================================================================
// I.7 — vendor payment settlement (cash leg of two-entry vendor invoice pattern)
// =============================================================================

function lvVendor(): CounterpartyRow {
  return {
    ...lvSeller(),
    id: '44444444-4444-4444-4444-444444444444',
    type: 'vendor',
    full_name: 'Unisend Latvia SIA',
    country: 'LV',
    tax_status: 'vat_registered',
    vendor_code: 'UN'
  };
}

describe('I.7 — vendor payment settlement', () => {
  const I_7 = findMappingById('I.7');

  it('exists in MAPPING_TABLE', () => {
    expect(I_7).toBeDefined();
    expect(I_7?.routing.event_type).toBe('vendor.payment_made');
    expect(I_7?.vat_rate_country).toBeNull();
    expect(I_7?.reporting.pvn_lines).toEqual([]);
  });

  it('produces 2-line entry: Dr payable_account / Cr 2610 (default bank)', () => {
    const out = I_7!.compute(buildInput(lvVendor(), null, {
      payment_cents: 191,
      payable_account: '5310-HE',
      vendor_invoice_number: '084000791607'
    }));
    expect(out.lines).toHaveLength(2);
    expect(out.lines[0]).toMatchObject({
      account_code: '5310-HE',
      debit_cents: 191,
      credit_cents: 0,
      counterparty_type: 'vendor',
      counterparty_id: lvVendor().id
    });
    expect(out.lines[1]).toMatchObject({
      account_code: '2610',
      debit_cents: 0,
      credit_cents: 191
    });
    expect(out.posting_context_extras).toMatchObject({
      payment_cents: 191,
      payable_account: '5310-HE',
      bank_account: '2610'
    });
  });

  it('honors bank_account override (e.g. 2630 EveryPay clearing)', () => {
    const out = I_7!.compute(buildInput(lvVendor(), null, {
      payment_cents: 100,
      payable_account: '5310-UN',
      vendor_invoice_number: 'UN-2601206',
      bank_account: '2630'
    }));
    expect(out.lines[1].account_code).toBe('2630');
    expect(out.posting_context_extras).toMatchObject({ bank_account: '2630' });
  });

  it('balanced: Σ Dr = Σ Cr = payment_cents', () => {
    const out = I_7!.compute(buildInput(lvVendor(), null, {
      payment_cents: 390,
      payable_account: '5310-UN',
      vendor_invoice_number: 'UN-2601206'
    }));
    const totalDr = out.lines.reduce((s, l) => s + l.debit_cents, 0);
    const totalCr = out.lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(totalDr).toBe(390);
    expect(totalCr).toBe(390);
  });

  it('every line has exactly one of debit/credit non-zero (journal_lines CHECK)', () => {
    const out = I_7!.compute(buildInput(lvVendor(), null, {
      payment_cents: 191,
      payable_account: '5310-HE',
      vendor_invoice_number: '084000791607'
    }));
    for (const line of out.lines) {
      expect((line.debit_cents === 0) !== (line.credit_cents === 0)).toBe(true);
    }
  });

  it('throws when counterparty is missing (engine invariant)', () => {
    expect(() => I_7!.compute({
      counterparty: null,
      vat_rate: null,
      posting_date: '2026-04-07',
      payload: { payment_cents: 191, payable_account: '5310-HE', vendor_invoice_number: '084000791607' }
    })).toThrow(/I\.7 compute requires counterparty/);
  });

  it('throws when payment_cents is missing', () => {
    expect(() => I_7!.compute(buildInput(lvVendor(), null, {
      payable_account: '5310-HE',
      vendor_invoice_number: '084000791607'
    }))).toThrow();
  });

  it('throws when payable_account is missing', () => {
    expect(() => I_7!.compute(buildInput(lvVendor(), null, {
      payment_cents: 191,
      vendor_invoice_number: '084000791607'
    }))).toThrow();
  });

  it('throws when vendor_invoice_number is missing', () => {
    expect(() => I_7!.compute(buildInput(lvVendor(), null, {
      payment_cents: 191,
      payable_account: '5310-HE'
    }))).toThrow();
  });
});

// =============================================================================
// PR C commit 9 — C.1 / C.2 multi-leg shape + C.9 cart-time partial refund
// =============================================================================

describe('C.1 — cart payment, EveryPay card', () => {
  const C_1 = () => findMappingById('C.1')!;

  it('emits 2 lines when buyer paid entirely via EveryPay', () => {
    const result = C_1().compute(
      buildInput(null as unknown as CounterpartyRow, null, {
        gross_cart_cents: 10000,
        buyer_wallet_cents: 0,
        payment_method: 'card'
      })
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({ account_code: '2630', debit_cents: 10000, credit_cents: 0 });
    expect(result.lines[1]).toMatchObject({ account_code: '5590', debit_cents: 0, credit_cents: 10000 });
    expect(result.posting_context_extras).toMatchObject({
      gross_cart_cents: 10000,
      buyer_wallet_cents: 0,
      everypay_charge_cents: 10000
    });
  });

  it('emits 3 lines (Dr 2630 + Dr 5351 + Cr 5590) when buyer paid partially from wallet', () => {
    const result = C_1().compute(
      buildInput(null as unknown as CounterpartyRow, null, {
        gross_cart_cents: 10000,
        buyer_wallet_cents: 3000,
        buyer_id: 'b0000000-0000-0000-0000-000000000001',
        payment_method: 'card'
      })
    );

    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toMatchObject({ account_code: '2630', debit_cents: 7000, credit_cents: 0 });
    expect(result.lines[1]).toMatchObject({
      account_code: '5351',
      debit_cents: 3000,
      credit_cents: 0,
      counterparty_type: 'buyer',
      counterparty_id: null
    });
    expect(result.lines[2]).toMatchObject({ account_code: '5590', debit_cents: 0, credit_cents: 10000 });

    // Σ Dr (7000 + 3000) = Σ Cr (10000) — balanced
    const sum_dr = result.lines.reduce((s, l) => s + l.debit_cents, 0);
    const sum_cr = result.lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(sum_dr).toBe(sum_cr);
    expect(sum_dr).toBe(10000);
  });

  it('omits the 2630 line when buyer paid 100% from wallet (full-wallet cart)', () => {
    const result = C_1().compute(
      buildInput(null as unknown as CounterpartyRow, null, {
        gross_cart_cents: 5000,
        buyer_wallet_cents: 5000,
        buyer_id: 'b0000000-0000-0000-0000-000000000001',
        payment_method: 'card'
      })
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({ account_code: '5351', debit_cents: 5000, counterparty_type: 'buyer' });
    expect(result.lines[1]).toMatchObject({ account_code: '5590', credit_cents: 5000 });
  });

  it('rejects when buyer_wallet_cents exceeds gross_cart_cents', () => {
    expect(() =>
      C_1().compute(
        buildInput(null as unknown as CounterpartyRow, null, {
          gross_cart_cents: 5000,
          buyer_wallet_cents: 6000,
          buyer_id: 'b0000000-0000-0000-0000-000000000001',
          payment_method: 'card'
        })
      )
    ).toThrow(/cannot exceed gross_cart_cents/);
  });

  it('rejects 3-line variant without buyer_id', () => {
    expect(() =>
      C_1().compute(
        buildInput(null as unknown as CounterpartyRow, null, {
          gross_cart_cents: 10000,
          buyer_wallet_cents: 3000,
          payment_method: 'card'
        })
      )
    ).toThrow();
  });
});

describe('C.2 — cart payment, PIS / bank-link', () => {
  const C_2 = () => findMappingById('C.2')!;

  it('emits 2 lines (Dr 2610 + Cr 5590) for full-EveryPay PIS payment', () => {
    const result = C_2().compute(
      buildInput(null as unknown as CounterpartyRow, null, {
        gross_cart_cents: 5000,
        buyer_wallet_cents: 0,
        payment_method: 'bank_link'
      })
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({ account_code: '2610', debit_cents: 5000, credit_cents: 0 });
    expect(result.lines[1]).toMatchObject({ account_code: '5590', debit_cents: 0, credit_cents: 5000 });
  });

  it('emits 3 lines for PIS with buyer wallet contribution', () => {
    const result = C_2().compute(
      buildInput(null as unknown as CounterpartyRow, null, {
        gross_cart_cents: 5000,
        buyer_wallet_cents: 1500,
        buyer_id: 'b0000000-0000-0000-0000-000000000002',
        payment_method: 'bank_link'
      })
    );

    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toMatchObject({ account_code: '2610', debit_cents: 3500 });
    expect(result.lines[1]).toMatchObject({ account_code: '5351', debit_cents: 1500, counterparty_type: 'buyer' });
    expect(result.lines[2]).toMatchObject({ account_code: '5590', credit_cents: 5000 });
  });
});

describe('C.9 — cart-time partial refund cash leg', () => {
  const C_9 = () => findMappingById('C.9')!;

  it('emits 2 lines (Dr 5590 + Cr 2630) for EveryPay-only partial refund (card)', () => {
    const result = C_9().compute(
      buildInput(null as unknown as CounterpartyRow, null, {
        refund_cents: 3000,
        buyer_wallet_refund_cents: 0,
        payment_method: 'card'
      })
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({ account_code: '5590', debit_cents: 3000, credit_cents: 0 });
    expect(result.lines[1]).toMatchObject({ account_code: '2630', debit_cents: 0, credit_cents: 3000 });
  });

  it('emits 2 lines (Dr 5590 + Cr 2610) for PIS partial refund', () => {
    const result = C_9().compute(
      buildInput(null as unknown as CounterpartyRow, null, {
        refund_cents: 1200,
        buyer_wallet_refund_cents: 0,
        payment_method: 'bank_link'
      })
    );

    expect(result.lines[1]).toMatchObject({ account_code: '2610', credit_cents: 1200 });
  });

  it('emits 3 lines (Dr 5590 + Cr 2630 + Cr 5351-buyer) when wallet was refunded too', () => {
    const result = C_9().compute(
      buildInput(null as unknown as CounterpartyRow, null, {
        refund_cents: 4000,
        buyer_wallet_refund_cents: 1000,
        buyer_id: 'b0000000-0000-0000-0000-000000000003',
        payment_method: 'card'
      })
    );

    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toMatchObject({ account_code: '5590', debit_cents: 4000 });
    expect(result.lines[1]).toMatchObject({ account_code: '2630', credit_cents: 3000 });
    expect(result.lines[2]).toMatchObject({
      account_code: '5351',
      credit_cents: 1000,
      counterparty_type: 'buyer',
      counterparty_id: null
    });

    const sum_dr = result.lines.reduce((s, l) => s + l.debit_cents, 0);
    const sum_cr = result.lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(sum_dr).toBe(sum_cr);
  });

  it('omits the 2630 leg when the refund came entirely from wallet allocation', () => {
    const result = C_9().compute(
      buildInput(null as unknown as CounterpartyRow, null, {
        refund_cents: 800,
        buyer_wallet_refund_cents: 800,
        buyer_id: 'b0000000-0000-0000-0000-000000000003',
        payment_method: 'card'
      })
    );

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({ account_code: '5590', debit_cents: 800 });
    expect(result.lines[1]).toMatchObject({ account_code: '5351', credit_cents: 800 });
  });

  it('rejects invalid payment_method', () => {
    expect(() =>
      C_9().compute(
        buildInput(null as unknown as CounterpartyRow, null, {
          refund_cents: 1000,
          buyer_wallet_refund_cents: 0,
          payment_method: 'crypto'
        })
      )
    ).toThrow(/payment_method must be 'card' or 'bank_link'/);
  });

  it('rejects when buyer_wallet_refund_cents exceeds refund_cents', () => {
    expect(() =>
      C_9().compute(
        buildInput(null as unknown as CounterpartyRow, null, {
          refund_cents: 1000,
          buyer_wallet_refund_cents: 1500,
          buyer_id: 'b0000000-0000-0000-0000-000000000003',
          payment_method: 'card'
        })
      )
    ).toThrow(/cannot exceed refund_cents/);
  });
});
