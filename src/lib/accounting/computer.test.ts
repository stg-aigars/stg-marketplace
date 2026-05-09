import { describe, it, expect } from 'vitest';

import { assertBalanced, decomposeFx, requireNumber, requireString, roundHalfUpCents } from './computer';
import { PostingValidationError } from './errors';

describe('roundHalfUpCents', () => {
  describe('half-up boundary', () => {
    it('rounds 0.5 up to 1', () => {
      expect(roundHalfUpCents(0.5)).toBe(1);
    });

    it('rounds 1.5 up to 2', () => {
      expect(roundHalfUpCents(1.5)).toBe(2);
    });

    it('rounds 2.5 up to 3', () => {
      expect(roundHalfUpCents(2.5)).toBe(3);
    });

    it('rounds -0.5 to 0 (half-up: rounds toward +∞)', () => {
      expect(roundHalfUpCents(-0.5)).toBe(0);
    });

    it('rounds -1.5 to -1', () => {
      expect(roundHalfUpCents(-1.5)).toBe(-1);
    });
  });

  describe('integer pass-through', () => {
    it('returns 0 unchanged', () => {
      expect(roundHalfUpCents(0)).toBe(0);
    });

    it('returns positive integer unchanged', () => {
      expect(roundHalfUpCents(42)).toBe(42);
    });

    it('returns negative integer unchanged', () => {
      expect(roundHalfUpCents(-42)).toBe(-42);
    });
  });

  describe('VAT compute regression cases', () => {
    // Lock the float-arithmetic cases that matter for our engine. These are
    // the actual outputs of `service_value_eur_cents * 0.21` for the §F
    // worked example and adjacent values.

    it('handles 361.83 (= 1723 × 0.21) → 362', () => {
      // 1723 * 0.21 in float = 361.82999999999998
      // + 0.5 = 362.32999...
      // floor = 362
      expect(roundHalfUpCents(1723 * 0.21)).toBe(362);
    });

    it('handles 105 (= 500 × 0.21) → 105', () => {
      expect(roundHalfUpCents(500 * 0.21)).toBe(105);
    });

    it('handles 315 (= 1500 × 0.21) → 315', () => {
      expect(roundHalfUpCents(1500 * 0.21)).toBe(315);
    });

    it('handles fraction-down rounding: 0.49 → 0', () => {
      expect(roundHalfUpCents(0.49)).toBe(0);
    });

    it('handles fraction-up rounding: 0.51 → 1', () => {
      expect(roundHalfUpCents(0.51)).toBe(1);
    });
  });

  describe('input validation', () => {
    it('throws PostingValidationError on NaN', () => {
      expect(() => roundHalfUpCents(NaN)).toThrow(PostingValidationError);
    });

    it('throws PostingValidationError on Infinity', () => {
      expect(() => roundHalfUpCents(Infinity)).toThrow(PostingValidationError);
    });

    it('throws PostingValidationError on -Infinity', () => {
      expect(() => roundHalfUpCents(-Infinity)).toThrow(PostingValidationError);
    });
  });
});

describe('decomposeFx', () => {
  describe('§F.3 Cursor September verbatim', () => {
    // The canonical worked example from stg-vat-mapping-table-v3.md §F.3.
    // This test is the lock-in: any change here is a behavior change.
    it('decomposes 20.00 USD @ 1.160766 / 17.74 EUR into 17.23 + 0.51', () => {
      const result = decomposeFx({
        foreign_amount: 20.00,
        fx_rate: 1.160766,
        bank_amount_eur: 17.74
      });
      expect(result.service_value_eur_cents).toBe(1723);
      expect(result.fx_fee_eur_cents).toBe(51);
      // Sanity: parts sum to bank amount
      expect(result.service_value_eur_cents + result.fx_fee_eur_cents).toBe(1774);
    });

    it('produces RC VAT of €3.62 when service value × 21% rounds half-up', () => {
      const result = decomposeFx({
        foreign_amount: 20.00,
        fx_rate: 1.160766,
        bank_amount_eur: 17.74
      });
      const rc_vat_cents = roundHalfUpCents(result.service_value_eur_cents * 0.21);
      expect(rc_vat_cents).toBe(362);
    });
  });

  describe('rejection paths', () => {
    it('throws on zero fx_rate', () => {
      expect(() =>
        decomposeFx({ foreign_amount: 20, fx_rate: 0, bank_amount_eur: 17.74 })
      ).toThrow(PostingValidationError);
    });

    it('throws on negative fx_rate', () => {
      expect(() =>
        decomposeFx({ foreign_amount: 20, fx_rate: -1.0, bank_amount_eur: 17.74 })
      ).toThrow(PostingValidationError);
    });

    it('throws on zero foreign_amount', () => {
      expect(() =>
        decomposeFx({ foreign_amount: 0, fx_rate: 1.16, bank_amount_eur: 17.74 })
      ).toThrow(PostingValidationError);
    });

    it('throws on zero bank_amount_eur', () => {
      expect(() =>
        decomposeFx({ foreign_amount: 20, fx_rate: 1.16, bank_amount_eur: 0 })
      ).toThrow(PostingValidationError);
    });

    it('throws when fx_fee would be negative (bank_amount < implied service_value)', () => {
      // foreign_amount=20, fx_rate=1.0 → service=2000 cents (€20.00)
      // bank_amount=10.00 → 1000 cents → fee = 1000 - 2000 = -1000 (negative)
      // This input set is semantically inconsistent; engine must reject before
      // the negative cents value lands in journal_lines.debit_cents (CHECK >= 0).
      expect(() =>
        decomposeFx({ foreign_amount: 20, fx_rate: 1.0, bank_amount_eur: 10.0 })
      ).toThrow(/negative fx_fee_eur_cents/);
    });

    it('accepts fx_fee=0 (perfect conversion, no FX margin)', () => {
      // foreign_amount=10, fx_rate=1.0 → service=1000 cents
      // bank_amount=10.00 → 1000 cents → fee = 0 (allowed)
      const result = decomposeFx({ foreign_amount: 10, fx_rate: 1.0, bank_amount_eur: 10.0 });
      expect(result.service_value_eur_cents).toBe(1000);
      expect(result.fx_fee_eur_cents).toBe(0);
    });
  });
});

describe('requireNumber', () => {
  it('returns the number when present and positive', () => {
    expect(requireNumber({ foo: 42 }, 'foo')).toBe(42);
  });

  it('coerces stringified numbers', () => {
    expect(requireNumber({ foo: '42' }, 'foo')).toBe(42);
  });

  it('throws on missing key', () => {
    expect(() => requireNumber({}, 'foo')).toThrow(PostingValidationError);
  });

  it('throws on null', () => {
    expect(() => requireNumber({ foo: null }, 'foo')).toThrow(PostingValidationError);
  });

  it('throws on NaN', () => {
    expect(() => requireNumber({ foo: 'abc' }, 'foo')).toThrow(PostingValidationError);
  });

  it('throws on negative by default', () => {
    expect(() => requireNumber({ foo: -1 }, 'foo')).toThrow(PostingValidationError);
  });

  it('admits negative with allowNegative=true', () => {
    expect(requireNumber({ foo: -1 }, 'foo', { allowNegative: true })).toBe(-1);
  });

  it('throws on zero by default', () => {
    expect(() => requireNumber({ foo: 0 }, 'foo')).toThrow(PostingValidationError);
  });

  it('admits zero with allowZero=true', () => {
    expect(requireNumber({ foo: 0 }, 'foo', { allowZero: true })).toBe(0);
  });
});

describe('requireString', () => {
  it('returns the string', () => {
    expect(requireString({ foo: 'bar' }, 'foo')).toBe('bar');
  });

  it('throws on missing', () => {
    expect(() => requireString({}, 'foo')).toThrow(PostingValidationError);
  });

  it('throws on empty string', () => {
    expect(() => requireString({ foo: '' }, 'foo')).toThrow(PostingValidationError);
  });

  it('throws on number', () => {
    expect(() => requireString({ foo: 42 }, 'foo')).toThrow(PostingValidationError);
  });
});

describe('assertBalanced', () => {
  it('passes for balanced 2-line entry', () => {
    expect(() =>
      assertBalanced([
        { debit_cents: 100, credit_cents: 0 },
        { debit_cents: 0, credit_cents: 100 }
      ])
    ).not.toThrow();
  });

  it('passes for balanced 4-line entry', () => {
    expect(() =>
      assertBalanced([
        { debit_cents: 1815, credit_cents: 0 },
        { debit_cents: 0, credit_cents: 1000 },
        { debit_cents: 0, credit_cents: 500 },
        { debit_cents: 0, credit_cents: 315 }
      ])
    ).not.toThrow();
  });

  it('throws on Σdr ≠ Σcr', () => {
    expect(() =>
      assertBalanced([
        { debit_cents: 100, credit_cents: 0 },
        { debit_cents: 0, credit_cents: 50 }
      ])
    ).toThrow(PostingValidationError);
  });

  it('throws with descriptive context', () => {
    try {
      assertBalanced([
        { debit_cents: 100, credit_cents: 0 },
        { debit_cents: 0, credit_cents: 50 }
      ]);
      throw new Error('should have thrown');
    } catch (e) {
      if (e instanceof PostingValidationError) {
        expect(e.code).toBe('unbalanced_lines');
        expect(e.context.total_dr).toBe(100);
        expect(e.context.total_cr).toBe(50);
      } else {
        throw e;
      }
    }
  });
});
