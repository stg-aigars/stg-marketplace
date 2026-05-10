import { describe, it, expect } from 'vitest';

import { dispatch, matchesRouting } from './dispatcher';
import { PostingValidationError } from './errors';
import { MAPPING_TABLE } from './mapping';
import type { CounterpartyRow, DispatchContext } from './types';

// =============================================================================
// Synthetic counterparty fixtures
// =============================================================================

function lvSeller(overrides: Partial<CounterpartyRow> = {}): CounterpartyRow {
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
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function ltSellerB2B(): CounterpartyRow {
  return lvSeller({
    id: '22222222-2222-2222-2222-222222222222',
    country: 'LT',
    tax_status: 'vat_registered',
    vat_number: 'LT123456789',
    vies_verified_at: '2026-01-01T00:00:00Z'
  });
}

function ltSellerB2C(): CounterpartyRow {
  return lvSeller({
    id: '33333333-3333-3333-3333-333333333333',
    country: 'LT',
    tax_status: 'private',
    vies_verified_at: null
  });
}

function eeSellerB2B(): CounterpartyRow {
  return lvSeller({
    id: '88888888-8888-8888-8888-888888888888',
    country: 'EE',
    tax_status: 'vat_registered',
    vat_number: 'EE100247025',
    vies_verified_at: '2026-01-01T00:00:00Z'
  });
}

function eeSellerB2C(): CounterpartyRow {
  return lvSeller({
    id: '99999999-9999-9999-9999-999999999999',
    country: 'EE',
    tax_status: 'private',
    vies_verified_at: null
  });
}

function lvVendor(): CounterpartyRow {
  return lvSeller({
    id: '44444444-4444-4444-4444-444444444444',
    type: 'vendor',
    full_name: 'Unisend',
    country: 'LV',
    tax_status: null,
    vendor_code: 'UN'
  });
}

function nonEuVendor(): CounterpartyRow {
  return lvSeller({
    id: '55555555-5555-5555-5555-555555555555',
    type: 'vendor',
    full_name: 'Anthropic',
    country: 'US',
    tax_status: null,
    vendor_code: 'AN'
  });
}

function lvVendorRcCapable(): CounterpartyRow {
  // LV vendor that issues invoices under domestic reverse charge (Article 143.7
  // categories — laptops, mobile phones, etc.). C&C EE OU Latvijas filiāle
  // appears in Phase 0 backfill (Entry 14a, MacBook Pro acquisition).
  return lvSeller({
    id: '66666666-6666-6666-6666-666666666666',
    type: 'vendor',
    full_name: 'C&C EE OU Latvijas filiāle',
    country: 'LV',
    tax_status: 'vat_registered',
    vat_number: 'LV40103177024',
    vendor_code: 'CC'
  });
}

function euB2bVendor(): CounterpartyRow {
  // EU member-state vendor (NL) — Mollie B2B reverse-charge flow. Phase 0
  // Entry 16 uses Mollie €0.01 verification charge.
  return lvSeller({
    id: '77777777-7777-7777-7777-777777777777',
    type: 'vendor',
    full_name: 'Stichting Mollie Payments',
    country: 'NL',
    tax_status: 'vat_registered',
    vat_number: 'NL850853286B01',
    vendor_code: 'ML'
  });
}

// =============================================================================
// Representative events per type — used for self-match + mutual-exclusivity
// =============================================================================

interface Representative {
  type_id: string;
  ctx: DispatchContext;
}

const REPRESENTATIVES: Representative[] = [
  {
    type_id: 'O.1',
    ctx: {
      event_type: 'order.completed',
      counterparty: lvSeller(),
      payload: {}
    }
  },
  {
    type_id: 'O.2',
    ctx: {
      event_type: 'order.completed',
      counterparty: ltSellerB2B(),
      payload: {}
    }
  },
  {
    type_id: 'O.3',
    ctx: {
      event_type: 'order.completed',
      counterparty: ltSellerB2C(),
      payload: {}
    }
  },
  {
    type_id: 'O.4',
    ctx: {
      event_type: 'order.completed',
      counterparty: eeSellerB2B(),
      payload: {}
    }
  },
  {
    type_id: 'O.5',
    ctx: {
      event_type: 'order.completed',
      counterparty: eeSellerB2C(),
      payload: {}
    }
  },
  {
    type_id: 'I.1',
    ctx: {
      event_type: 'vendor.invoice_received',
      counterparty: lvVendor(),
      payload: { vat_treatment: 'standard' }
    }
  },
  {
    type_id: 'I.4',
    ctx: {
      event_type: 'vendor.invoice_received',
      counterparty: nonEuVendor(),
      payload: { vat_treatment: 'non_eu_rc' }
    }
  },
  {
    type_id: 'P.1',
    ctx: {
      event_type: 'period_close.monthly_refund',
      counterparty: null,
      payload: {}
    }
  },
  {
    type_id: 'H.1',
    ctx: {
      event_type: 'historical.override',
      counterparty: null,
      payload: { override_type: 'historical_filing_alignment' }
    }
  },
  {
    type_id: 'C.4',
    ctx: {
      event_type: 'seller.withdrawal_requested',
      counterparty: lvSeller(),
      payload: {}
    }
  },
  {
    type_id: 'C.6',
    ctx: {
      event_type: 'equity.share_capital_received',
      counterparty: null,
      payload: {}
    }
  },
  // PR #3 additions (Phase 0 backfill)
  {
    type_id: 'I.2',
    ctx: {
      event_type: 'vendor.invoice_received',
      counterparty: lvVendorRcCapable(),
      payload: { vat_treatment: 'domestic_rc' }
    }
  },
  {
    type_id: 'I.3',
    ctx: {
      event_type: 'vendor.invoice_received',
      counterparty: euB2bVendor(),
      payload: { vat_treatment: 'eu_b2b_rc' }
    }
  },
  {
    type_id: 'I.5',
    ctx: {
      event_type: 'bank.fee_charged',
      counterparty: null,
      payload: { fee_type: 'pis_commission' }
    }
  },
  {
    type_id: 'H.2',
    ctx: {
      event_type: 'historical.override',
      counterparty: null,
      payload: { override_type: 'input_forfeited' }
    }
  },
  {
    type_id: 'H.3',
    ctx: {
      event_type: 'historical.override',
      counterparty: null,
      payload: { override_type: 'pre_registration_gross' }
    }
  },
  {
    type_id: 'P.6',
    ctx: {
      event_type: 'cron.monthly_depreciation',
      counterparty: null,
      payload: {}
    }
  },
  {
    type_id: 'P.7',
    ctx: {
      event_type: 'period_close.annual',
      counterparty: null,
      payload: {}
    }
  },
  {
    type_id: 'C.7',
    ctx: {
      event_type: 'equity.shareholder_loan_received',
      counterparty: null,
      payload: {}
    }
  },
  {
    type_id: 'C.8',
    ctx: {
      event_type: 'vid.refund_received',
      counterparty: null,
      payload: {}
    }
  },
  // PR #5 commit 3 additions (O.7 / O.8 refund credit notes; C.1 / C.2 / C.3 / C.5 cash legs)
  {
    type_id: 'O.7',
    ctx: {
      event_type: 'order.refunded',
      counterparty: lvSeller(),
      payload: { tax_period_alignment: 'current' }
    }
  },
  {
    type_id: 'O.8',
    ctx: {
      event_type: 'order.refunded',
      counterparty: lvSeller(),
      payload: { tax_period_alignment: 'prior' }
    }
  },
  {
    type_id: 'O.9',
    ctx: {
      event_type: 'order.partial_refunded',
      counterparty: lvSeller(),
      payload: {}
    }
  },
  {
    type_id: 'C.1',
    ctx: {
      event_type: 'everypay.payment_confirmed',
      counterparty: null,
      payload: { payment_method: 'card' }
    }
  },
  {
    type_id: 'C.2',
    ctx: {
      event_type: 'everypay.payment_confirmed',
      counterparty: null,
      payload: { payment_method: 'bank_link' }
    }
  },
  {
    type_id: 'C.3',
    ctx: {
      event_type: 'everypay.daily_settlement_received',
      counterparty: null,
      payload: {}
    }
  },
  {
    type_id: 'C.5',
    ctx: {
      event_type: 'order.refund_initiated',
      counterparty: null,
      payload: { funding_source: 'everypay' }
    }
  }
];

// =============================================================================
// Per-type self-match tests
// =============================================================================

describe('dispatch — per-type self-match', () => {
  for (const rep of REPRESENTATIVES) {
    it(`routes its representative event to ${rep.type_id}`, () => {
      const result = dispatch(rep.ctx);
      expect(result.id).toBe(rep.type_id);
    });
  }
});

// =============================================================================
// Mutual-exclusivity test (the contract — every event matches exactly ONE type)
// =============================================================================

describe('dispatch — mutual exclusivity', () => {
  it('every representative event matches exactly one mapping entry', () => {
    for (const rep of REPRESENTATIVES) {
      const matches = MAPPING_TABLE.filter((entry) =>
        matchesRouting(rep.ctx, entry.routing)
      );
      expect(matches.length, `${rep.type_id} representative event matched ${matches.length} types: [${matches.map((m) => m.id).join(', ')}]`).toBe(1);
      expect(matches[0]?.id).toBe(rep.type_id);
    }
  });

  it('representative event count equals MAPPING_TABLE length', () => {
    // If MAPPING_TABLE grows, REPRESENTATIVES must grow with it. This guard
    // catches the case where a new type ships without a representative event.
    expect(REPRESENTATIVES.length).toBe(MAPPING_TABLE.length);
  });
});

// =============================================================================
// Rejection: no matching type
// =============================================================================

describe('dispatch — rejection', () => {
  it('throws PostingValidationError when no type matches event_type', () => {
    expect(() =>
      dispatch({
        event_type: 'unknown.event_type',
        counterparty: null,
        payload: {}
      })
    ).toThrow(PostingValidationError);
  });

  it('throws when LT seller is not vat_registered AND not private (e.g. invalid tax_status that doesn’t match O.2 or O.3)', () => {
    // Synthetic edge case: tax_status='sole_proprietor' — O.3's conditions
    // include sole_proprietor in the IN list, so this SHOULD match O.3.
    // Asserting the IN-list semantics works correctly for sole_proprietor.
    const result = dispatch({
      event_type: 'order.completed',
      counterparty: lvSeller({
        country: 'LT',
        tax_status: 'sole_proprietor'
      }),
      payload: {}
    });
    expect(result.id).toBe('O.3');
  });

  it('throws when LT vat_registered seller lacks VIES validation (vies_verified_at=null)', () => {
    // O.2 requires vies_verified_at !null; without it, the seller falls
    // through. tax_status='vat_registered' isn't in O.3's IN list, so
    // nothing matches — engine raises.
    expect(() =>
      dispatch({
        event_type: 'order.completed',
        counterparty: lvSeller({
          country: 'LT',
          tax_status: 'vat_registered',
          vies_verified_at: null
        }),
        payload: {}
      })
    ).toThrow(PostingValidationError);
  });
});

// =============================================================================
// matchValue helper coverage (via matchesRouting)
// =============================================================================

describe('matchesRouting — value match semantics', () => {
  it('!null sentinel matches non-null fields', () => {
    expect(
      matchesRouting(
        {
          event_type: 'test',
          counterparty: lvSeller({ vies_verified_at: '2026-01-01T00:00:00Z' }),
          payload: {}
        },
        {
          event_type: 'test',
          conditions: { 'counterparty.vies_verified_at': '!null' }
        }
      )
    ).toBe(true);
  });

  it('!null sentinel rejects null fields', () => {
    expect(
      matchesRouting(
        {
          event_type: 'test',
          counterparty: lvSeller({ vies_verified_at: null }),
          payload: {}
        },
        {
          event_type: 'test',
          conditions: { 'counterparty.vies_verified_at': '!null' }
        }
      )
    ).toBe(false);
  });

  it('array membership matches IN-list values', () => {
    expect(
      matchesRouting(
        {
          event_type: 'test',
          counterparty: lvSeller({ tax_status: 'sole_proprietor' }),
          payload: {}
        },
        {
          event_type: 'test',
          conditions: { 'counterparty.tax_status': ['private', 'sole_proprietor'] }
        }
      )
    ).toBe(true);
  });

  it('array membership rejects values not in list', () => {
    expect(
      matchesRouting(
        {
          event_type: 'test',
          counterparty: lvSeller({ tax_status: 'vat_registered' }),
          payload: {}
        },
        {
          event_type: 'test',
          conditions: { 'counterparty.tax_status': ['private', 'sole_proprietor'] }
        }
      )
    ).toBe(false);
  });

  it('matches payload field via dot-path', () => {
    expect(
      matchesRouting(
        {
          event_type: 'test',
          counterparty: null,
          payload: { override_type: 'historical_filing_alignment' }
        },
        {
          event_type: 'test',
          conditions: { 'payload.override_type': 'historical_filing_alignment' }
        }
      )
    ).toBe(true);
  });
});
