/**
 * Posting engine integration tests (PR #2).
 *
 * Exercises the engine end-to-end against a real local Supabase. Covers the
 * 7 critical scenarios named in the PR #2 plan acceptance criteria, plus
 * idempotency stress and KYC gate.
 *
 * All entries post to period 2027-01 (well outside Phase 0 backfill's
 * 2025-05 → 2026-03 window) and are tagged
 * posting_context.test_artifact=true. Entries persist permanently per the
 * V.4.b precedent — immutability trigger blocks DELETE on journal_entries.
 *
 * Test counterparties use deterministic UUIDs (UPSERTed in beforeAll) so
 * re-running the suite is idempotent: first run creates the GL entries;
 * subsequent runs hit idempotent_skip and assert the same entry_id.
 *
 * Re-runnability: every emit() returns an entry_id whether the result is
 * 'created' (first run) or 'idempotent_skip' (subsequent runs). Tests grab
 * the entry_id and assert journal-entry shape from the persisted row, which
 * is identical across runs.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { emit } from '@/lib/accounting/posting-engine';
import type { PostingEvent, PostingResult } from '@/lib/accounting/types';

import { createTestServiceClient } from '../helpers/supabase';

const supabase = createTestServiceClient();

// =============================================================================
// Deterministic test counterparty UUIDs
// =============================================================================

const TEST_CP = {
  LV_SELLER: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  LT_B2B_SELLER: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  LT_B2C_SELLER: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
  LV_VENDOR_UN: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
  US_VENDOR_AN: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
  LV_SELLER_PENDING_KYC: 'ffffffff-ffff-4fff-ffff-ffffffffffff'
} as const;

beforeAll(async () => {
  // UPSERT test counterparties. Service role bypasses RLS.
  const counterparties = [
    {
      id: TEST_CP.LV_SELLER,
      type: 'seller',
      full_name: 'PR2_INTEGRATION_TEST LV Seller',
      country: 'LV',
      tax_status: 'private',
      legal_compliance_status: 'ok'
    },
    {
      id: TEST_CP.LT_B2B_SELLER,
      type: 'seller',
      full_name: 'PR2_INTEGRATION_TEST LT B2B Seller',
      country: 'LT',
      tax_status: 'vat_registered',
      vat_number: 'LT123456789',
      vies_verified_at: '2026-01-01T00:00:00Z',
      legal_compliance_status: 'ok'
    },
    {
      id: TEST_CP.LT_B2C_SELLER,
      type: 'seller',
      full_name: 'PR2_INTEGRATION_TEST LT B2C Seller',
      country: 'LT',
      tax_status: 'private',
      legal_compliance_status: 'ok'
    },
    {
      id: TEST_CP.LV_VENDOR_UN,
      type: 'vendor',
      full_name: 'PR2_INTEGRATION_TEST Unisend',
      country: 'LV',
      vendor_code: 'UN'
    },
    {
      id: TEST_CP.US_VENDOR_AN,
      type: 'vendor',
      full_name: 'PR2_INTEGRATION_TEST Anthropic',
      country: 'US',
      vendor_code: 'AN'
    },
    {
      id: TEST_CP.LV_SELLER_PENDING_KYC,
      type: 'seller',
      full_name: 'PR2_INTEGRATION_TEST Blocked Seller',
      country: 'LV',
      tax_status: 'private',
      legal_compliance_status: 'pending_kyc'
    }
  ];

  for (const cp of counterparties) {
    const { error } = await supabase.from('counterparties').upsert(cp, { onConflict: 'id' });
    if (error) throw new Error(`UPSERT counterparty ${cp.id} failed: ${error.message}`);
  }
});

// =============================================================================
// Helpers
// =============================================================================

interface JournalEntryShape {
  id: string;
  type_id: string;
  entry_type: string;
  accounting_period: string;
  tax_period: string;
  posting_context: Record<string, unknown>;
  source_doc_type: string;
  source_doc_id: string;
}

interface JournalLineShape {
  line_number: number;
  account_code: string;
  debit_cents: number;
  credit_cents: number;
  vat_rate_snapshot: string | null;
  vat_country: string | null;
  counterparty_type: string | null;
  counterparty_id: string | null;
}

async function fetchEntryWithLines(entry_id: string): Promise<{
  entry: JournalEntryShape;
  lines: JournalLineShape[];
}> {
  const { data: entry, error: e1 } = await supabase
    .from('journal_entries')
    .select('id, type_id, entry_type, accounting_period, tax_period, posting_context, source_doc_type, source_doc_id')
    .eq('id', entry_id)
    .single();
  if (e1) throw new Error(`fetch entry failed: ${e1.message}`);

  const { data: lines, error: e2 } = await supabase
    .from('journal_lines')
    .select('line_number, account_code, debit_cents, credit_cents, vat_rate_snapshot, vat_country, counterparty_type, counterparty_id')
    .eq('entry_id', entry_id)
    .order('line_number', { ascending: true });
  if (e2) throw new Error(`fetch lines failed: ${e2.message}`);

  return { entry: entry as JournalEntryShape, lines: lines as JournalLineShape[] };
}

function expectEntryId(result: PostingResult): string {
  expect(result.status === 'created' || result.status === 'idempotent_skip').toBe(true);
  if (result.status === 'created' || result.status === 'idempotent_skip') {
    return result.entry_id;
  }
  throw new Error(`Unexpected status: ${(result as { status: string }).status}`);
}

// =============================================================================
// TC-1.lv — LV seller, basic O.1 completion
// =============================================================================

describe('TC-1.lv — LV seller O.1', () => {
  it('creates a 3-line commission-invoice slice (wallet debited only for commission)', async () => {
    const event: PostingEvent = {
      event_type: 'order.completed',
      source_doc_type: 'order',
      source_doc_id: 'pr2_tc_1_lv_order',
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      narrative: 'TC-1.lv — LV seller O.1',
      counterparty_id: TEST_CP.LV_SELLER,
      payload: {
        item_value_cents: 10000,
        shipping_value_cents: 500,
        order_id: 'pr2_tc_1_lv_order',
        seller_id: TEST_CP.LV_SELLER,
        invoice_number: 'STG-2027-PR2-00001',
        test_artifact: true
      }
    };
    const result = await emit(supabase, event);
    const entry_id = expectEntryId(result);

    const { entry, lines } = await fetchEntryWithLines(entry_id);
    expect(entry.type_id).toBe('O.1');
    expect(entry.entry_type).toBe('order');
    expect(entry.accounting_period).toBe('2027-01');
    expect(entry.posting_context.order_id).toBe('pr2_tc_1_lv_order');
    // Commission-invoice slice only: wallet sees just the commission. Buyer-
    // paid shipping (500) does NOT flow through 5351 — it lives in suspense
    // until PR #5's lifecycle slice releases it together with shipping
    // logistics revenue. Inclusive VAT (Seller Terms §8): commission_gross=1000
    // → 1000 / 1.21 ≈ 826.45 → 826 net; vat = 174.
    expect(entry.posting_context.commission_cents).toBe(1000);
    expect(entry.posting_context.commission_vat_cents).toBe(174);
    expect(entry.posting_context.vat_cents).toBe(174); // commission VAT only
    expect(entry.posting_context.shipping_value_cents).toBe(500);
    expect(entry.posting_context.shipping_vat_cents).toBe(87); // for PR #5

    expect(lines).toHaveLength(3);
    expect(lines[0].account_code).toBe('5351');
    expect(lines[0].debit_cents).toBe(1000);
    expect(lines[0].counterparty_id).toBe(TEST_CP.LV_SELLER);

    expect(lines[1].account_code).toBe('6310-C');
    expect(lines[1].credit_cents).toBe(826);
    expect(lines[1].vat_country).toBe('LV');
    expect(Number(lines[1].vat_rate_snapshot)).toBe(0.21);

    expect(lines[2].account_code).toBe('5710-LV-OUT');
    expect(lines[2].credit_cents).toBe(174);

    // Σdr = Σcr
    const total_dr = lines.reduce((s, l) => s + l.debit_cents, 0);
    const total_cr = lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(total_dr).toBe(total_cr);
    expect(total_dr).toBe(1000);
  });
});

// =============================================================================
// TC-2.lt.b2b — LT VAT-registered → O.2 with ESL flag
// =============================================================================

describe('TC-2.lt.b2b — LT B2B reverse-charge O.2', () => {
  it('creates a 2-line commission-invoice slice (vat_rate=0, no VAT line)', async () => {
    const event: PostingEvent = {
      event_type: 'order.completed',
      source_doc_type: 'order',
      source_doc_id: 'pr2_tc_2_lt_b2b_order',
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      narrative: 'TC-2.lt.b2b — LT B2B RC',
      counterparty_id: TEST_CP.LT_B2B_SELLER,
      payload: {
        item_value_cents: 10000,
        shipping_value_cents: 500,
        order_id: 'pr2_tc_2_lt_b2b_order',
        seller_id: TEST_CP.LT_B2B_SELLER,
        seller_vat_number: 'LT123456789',
        vies_verified_at: '2026-01-01T00:00:00Z',
        invoice_number: 'STG-2027-PR2-00002',
        test_artifact: true
      }
    };
    const result = await emit(supabase, event);
    const entry_id = expectEntryId(result);

    const { entry, lines } = await fetchEntryWithLines(entry_id);
    expect(entry.type_id).toBe('O.2');
    expect(entry.posting_context.esl_eligible).toBe(true);

    expect(lines).toHaveLength(2);
    // No VAT line — recipient self-assesses LT VAT. No shipping line —
    // PR #5's lifecycle slice handles shipping invoice issuance.
    expect(lines[0].account_code).toBe('5351');
    expect(lines[0].debit_cents).toBe(1000); // commission only

    expect(lines[1].account_code).toBe('6310-C');
    expect(lines[1].credit_cents).toBe(1000);
    expect(lines[1].vat_country).toBe('LT');
    expect(Number(lines[1].vat_rate_snapshot)).toBe(0);
  });
});

// =============================================================================
// TC-3.lt.b2c — LT private → O.3 with OSS routing to 5711
// =============================================================================

describe('TC-3.lt.b2c — LT B2C OSS O.3', () => {
  it('creates a 3-line commission-invoice slice with VAT routed to OSS-LT (5711)', async () => {
    const event: PostingEvent = {
      event_type: 'order.completed',
      source_doc_type: 'order',
      source_doc_id: 'pr2_tc_3_lt_b2c_order',
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      narrative: 'TC-3.lt.b2c — LT B2C OSS',
      counterparty_id: TEST_CP.LT_B2C_SELLER,
      payload: {
        item_value_cents: 10000,
        shipping_value_cents: 500,
        order_id: 'pr2_tc_3_lt_b2c_order',
        seller_id: TEST_CP.LT_B2C_SELLER,
        invoice_number: 'STG-2027-PR2-00003',
        consumption_ms: 'LT',
        test_artifact: true
      }
    };
    const result = await emit(supabase, event);
    const entry_id = expectEntryId(result);

    const { entry, lines } = await fetchEntryWithLines(entry_id);
    expect(entry.type_id).toBe('O.3');
    expect(entry.posting_context.oss_consumption_ms).toBe('LT');

    expect(lines).toHaveLength(3);
    expect(lines[0].account_code).toBe('5351');
    // Commission-invoice slice only (LT 21%): wallet sees commission_gross=1000.
    // Shipping (500) is recognized in PR #5's lifecycle slice, not here.
    // commission VAT: 1000 / 1.21 ≈ 826.45 → 826 net; vat = 174.
    expect(lines[0].debit_cents).toBe(1000);

    expect(lines[1].account_code).toBe('6310-C');
    expect(lines[1].vat_country).toBe('LT');
    expect(Number(lines[1].vat_rate_snapshot)).toBe(0.21);
    expect(lines[1].credit_cents).toBe(826);

    expect(lines[2].account_code).toBe('5711'); // OSS-LT, NOT 5710-LV-OUT
    expect(lines[2].credit_cents).toBe(174);
  });
});

// =============================================================================
// TC-9.unisend — I.1 LV vendor with standard VAT
// =============================================================================

describe('TC-9.unisend — I.1 LV vendor invoice', () => {
  it('books expense + input VAT + vendor payable for €3.90 (3.22 + 0.68)', async () => {
    const event: PostingEvent = {
      event_type: 'vendor.invoice_received',
      source_doc_type: 'vendor_invoice',
      source_doc_id: 'pr2_tc_9_unisend_2601206',
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      narrative: 'TC-9.unisend — I.1 vendor invoice',
      counterparty_id: TEST_CP.LV_VENDOR_UN,
      payload: {
        invoice_net_cents: 322,
        invoice_vat_cents: 68,
        expense_account: '7720',
        vendor_invoice_number: '2601206',
        vendor_vat_number: 'LV40203523445',
        invoice_date: '2027-01-15',
        vat_treatment: 'standard',
        test_artifact: true
      }
    };
    const result = await emit(supabase, event);
    const entry_id = expectEntryId(result);

    const { entry, lines } = await fetchEntryWithLines(entry_id);
    expect(entry.type_id).toBe('I.1');
    expect(entry.entry_type).toBe('manual');

    expect(lines).toHaveLength(3);
    expect(lines[0].account_code).toBe('7720');
    expect(lines[0].debit_cents).toBe(322);

    expect(lines[1].account_code).toBe('5710-LV-IN');
    expect(lines[1].debit_cents).toBe(68);
    expect(lines[1].vat_country).toBe('LV');
    expect(Number(lines[1].vat_rate_snapshot)).toBe(0.21);

    expect(lines[2].account_code).toBe('5310-UN');
    expect(lines[2].credit_cents).toBe(390);
  });
});

// =============================================================================
// TC-12.cursor.fx — I.4 with §F decomposition
// =============================================================================

describe('TC-12.cursor.fx — I.4 non-EU vendor with FX (§F.3 verbatim)', () => {
  it('decomposes 20.00 USD @ 1.160766 / 17.74 EUR into service €17.23 + FX fee €0.51 + RC VAT €3.62', async () => {
    const event: PostingEvent = {
      event_type: 'vendor.invoice_received',
      source_doc_type: 'vendor_invoice',
      source_doc_id: 'pr2_tc_12_cursor_fx',
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      narrative: 'TC-12.cursor.fx — §F.3 worked example',
      counterparty_id: TEST_CP.US_VENDOR_AN,
      payload: {
        usd_amount: 20.00,
        fx_rate: 1.160766,
        fx_rate_source: 'bank_transaction',
        bank_amount_eur: 17.74,
        expense_account: '7730',
        vendor_invoice_number: 'cursor-2027-01',
        vendor_country: 'US',
        invoice_currency: 'USD',
        vat_treatment: 'non_eu_rc',
        test_artifact: true
      }
    };
    const result = await emit(supabase, event);
    const entry_id = expectEntryId(result);

    const { entry, lines } = await fetchEntryWithLines(entry_id);
    expect(entry.type_id).toBe('I.4');
    // §F.3 exact decomposition values
    expect(entry.posting_context.service_value_eur_cents).toBe(1723);
    expect(entry.posting_context.fx_fee_eur_cents).toBe(51);
    expect(entry.posting_context.rc_vat_cents).toBe(362);

    expect(lines).toHaveLength(5);
    expect(lines[0].account_code).toBe('7730');
    expect(lines[0].debit_cents).toBe(1723);
    expect(lines[1].account_code).toBe('7710');
    expect(lines[1].debit_cents).toBe(51);
    expect(lines[2].account_code).toBe('5710-RC-IN');
    expect(lines[2].debit_cents).toBe(362);
    expect(lines[3].account_code).toBe('2610');
    expect(lines[3].credit_cents).toBe(1774); // 1723 + 51
    expect(lines[4].account_code).toBe('5710-RC-OUT');
    expect(lines[4].credit_cents).toBe(362);

    // Balanced: dr = 1723 + 51 + 362 = 2136; cr = 1774 + 362 = 2136
    const total_dr = lines.reduce((s, l) => s + l.debit_cents, 0);
    const total_cr = lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(total_dr).toBe(2136);
    expect(total_cr).toBe(2136);
  });
});

// =============================================================================
// TC-P1.january2026 — P.1 monthly close, refund posture
// =============================================================================

describe('TC-P1.january2026 — P.1 monthly VAT consolidation', () => {
  it('emits the pre-computed close with €13.05 refund', async () => {
    // Synthetic refund close: 5710-LV-OUT credit balance €5.00, 5710-LV-IN
    // debit balance €18.05 → net refund €13.05 to 2380.
    const event: PostingEvent = {
      event_type: 'period_close.monthly_refund',
      source_doc_type: 'period_close',
      source_doc_id: 'pr2_tc_p1_jan2026_close',
      posting_date: '2027-01-31',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      narrative: 'TC-P1 — Jan 2026 close synthetic',
      payload: {
        closing_period: '2026-01',
        net_refund_cents: 1305,
        test_artifact: true,
        lines: [
          { account_code: '5710-LV-OUT', debit_cents: 500, credit_cents: 0, narrative: 'Clear LV-OUT credit balance' },
          { account_code: '5710-LV-IN', debit_cents: 0, credit_cents: 1805, narrative: 'Clear LV-IN debit balance' },
          { account_code: '2380', debit_cents: 1305, credit_cents: 0, narrative: 'VID receivable (refund position)' },
          { account_code: '5710-09', debit_cents: 0, credit_cents: 0, narrative: 'Settlement clearing (zero net)' }
        ]
      }
    };
    // NB: the 5710-09 line has both 0 debit and 0 credit, which violates the
    // CHECK on journal_lines. Adjust the synthetic close to a balanced
    // 3-line shape (drop the zero settlement line — it isn't required when
    // the consolidation already nets to 2380):
    event.payload.lines = [
      { account_code: '5710-LV-OUT', debit_cents: 500, credit_cents: 0, narrative: 'Clear LV-OUT credit balance' },
      { account_code: '5710-LV-IN', debit_cents: 0, credit_cents: 1805, narrative: 'Clear LV-IN debit balance' },
      { account_code: '2380', debit_cents: 1305, credit_cents: 0, narrative: 'VID receivable (refund)' }
    ];

    const result = await emit(supabase, event);
    const entry_id = expectEntryId(result);

    const { entry, lines } = await fetchEntryWithLines(entry_id);
    expect(entry.type_id).toBe('P.1');
    expect(entry.entry_type).toBe('period_close');
    expect(entry.posting_context.net_refund_cents).toBe(1305);

    expect(lines).toHaveLength(3);
    const total_dr = lines.reduce((s, l) => s + l.debit_cents, 0);
    const total_cr = lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(total_dr).toBe(total_cr);
    expect(total_dr).toBe(1805);
  });
});

// =============================================================================
// TC-H1.dec2025 — H.1 historical override
// =============================================================================

describe('TC-H1.dec2025 — H.1 historical override', () => {
  it('emits a pre-computed historical entry with override metadata in posting_context', async () => {
    const event: PostingEvent = {
      event_type: 'historical.override',
      source_doc_type: 'historical_filing',
      source_doc_id: 'pr2_tc_h1_dec2025_override',
      posting_date: '2027-01-31',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      narrative: 'TC-H1 — December 2025 RC catch-up override',
      payload: {
        override_type: 'historical_filing_alignment',
        rc_override_reason: 'match_as_filed_2025_december',
        rc_base_filed: 35.17,
        filing_ref: 'EDS_110869581',
        rationale: 'PR #2 H.1 verification — synthetic period 2027-01',
        test_artifact: true,
        lines: [
          { account_code: '7730', debit_cents: 3517, credit_cents: 0, narrative: 'IT/SaaS expense (filed base)' },
          { account_code: '5710-RC-IN', debit_cents: 738, credit_cents: 0, narrative: 'RC input VAT (filed)' },
          { account_code: '2610', debit_cents: 0, credit_cents: 3517, narrative: 'Bank (filed gross)' },
          { account_code: '5710-RC-OUT', debit_cents: 0, credit_cents: 738, narrative: 'RC output VAT (filed)' }
        ]
      }
    };
    const result = await emit(supabase, event);
    const entry_id = expectEntryId(result);

    const { entry, lines } = await fetchEntryWithLines(entry_id);
    expect(entry.type_id).toBe('H.1');
    expect(entry.posting_context.override_type).toBe('historical_filing_alignment');
    expect(entry.posting_context.test_artifact).toBe(true);
    expect(entry.posting_context.filing_ref).toBe('EDS_110869581');

    expect(lines).toHaveLength(4);
    const total_dr = lines.reduce((s, l) => s + l.debit_cents, 0);
    const total_cr = lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(total_dr).toBe(total_cr);
    expect(total_dr).toBe(4255);
  });
});

// =============================================================================
// Idempotency stress test (concurrent emit, exactly one entry persists)
// =============================================================================

describe('Idempotency stress — 5 concurrent emit() calls', () => {
  it('persists exactly one journal_entries row; all 5 callers receive matching entry_id', async () => {
    const event: PostingEvent = {
      event_type: 'equity.share_capital_received',
      source_doc_type: 'equity_event',
      source_doc_id: 'pr2_idempotency_stress_C6',
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      narrative: 'Idempotency stress test (C.6)',
      payload: {
        contribution_cents: 100,
        founder_id: 'pr2-stress-founder',
        founding_doc_ref: 'pr2-stress-doc',
        test_artifact: true
      }
    };

    const promises = Array.from({ length: 5 }, () => emit(supabase, event));
    const results = await Promise.all(promises);

    const entry_ids = new Set(results.map(expectEntryId));
    expect(entry_ids.size).toBe(1); // all 5 callers see same entry_id

    // At least one created, the rest idempotent_skip (or all idempotent_skip
    // on re-run after first run already persisted).
    const stati = results.map((r) => r.status);
    const created_count = stati.filter((s) => s === 'created').length;
    const skip_count = stati.filter((s) => s === 'idempotent_skip').length;
    expect(created_count + skip_count).toBe(5);

    // Verify exactly 1 row in journal_entries with this source_doc_id.
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('source_doc_type', 'equity_event')
      .eq('source_doc_id', 'pr2_idempotency_stress_C6');
    if (error) throw error;
    expect(data).toHaveLength(1);
  });
});

// =============================================================================
// KYC gate integration test (C.4 against pending_kyc seller)
// =============================================================================

describe('KYC gate — C.4 blocked by pending_kyc', () => {
  it('rejects withdrawal with PostingComplianceGateError and writes no GL row', async () => {
    const event: PostingEvent = {
      event_type: 'seller.withdrawal_requested',
      source_doc_type: 'wallet_withdrawal',
      source_doc_id: 'pr2_kyc_blocked_withdrawal',
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      narrative: 'KYC gate test — should reject',
      counterparty_id: TEST_CP.LV_SELLER_PENDING_KYC,
      payload: {
        withdrawal_cents: 5000,
        seller_id: TEST_CP.LV_SELLER_PENDING_KYC,
        withdrawal_ref: 'STG WD-PR2-KYC-TEST',
        seller_iban: 'LV80BANK0000435195001',
        test_artifact: true
      }
    };
    const result = await emit(supabase, event);
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error).toContain('PostingComplianceGateError');
      expect(result.error).toContain('kyc_gate');
    }

    // Verify no journal_entries row was created.
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('source_doc_type', 'wallet_withdrawal')
      .eq('source_doc_id', 'pr2_kyc_blocked_withdrawal');
    if (error) throw error;
    expect(data).toHaveLength(0);
  });

  it('passes C.4 when seller status flips to ok (re-uses LV_SELLER which is ok)', async () => {
    const event: PostingEvent = {
      event_type: 'seller.withdrawal_requested',
      source_doc_type: 'wallet_withdrawal',
      source_doc_id: 'pr2_kyc_ok_withdrawal',
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      narrative: 'KYC gate test — happy path',
      counterparty_id: TEST_CP.LV_SELLER,
      payload: {
        withdrawal_cents: 100,
        seller_id: TEST_CP.LV_SELLER,
        withdrawal_ref: 'STG WD-PR2-KYC-OK',
        seller_iban: 'LV80BANK0000435195001',
        test_artifact: true
      }
    };
    const result = await emit(supabase, event);
    const entry_id = expectEntryId(result);

    const { entry, lines } = await fetchEntryWithLines(entry_id);
    expect(entry.type_id).toBe('C.4');
    expect(entry.entry_type).toBe('payout');
    expect(lines).toHaveLength(2);
    expect(lines[0].account_code).toBe('5351');
    expect(lines[0].debit_cents).toBe(100);
    expect(lines[1].account_code).toBe('2610');
    expect(lines[1].credit_cents).toBe(100);
  });
});
