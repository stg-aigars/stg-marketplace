/**
 * Period-close checklist unit tests — mocked supabase (PR #4, Task 5).
 *
 * Covers each of the 9 items' status transitions (pass / fail /
 * manual_pending / not_applicable where applicable) and the three gating
 * flags (can_soft_lock / can_hard_lock / can_unsoft_lock). These are the
 * safety invariants for period-state mutations — gate logic must be tested
 * explicitly, not implied.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPeriodCloseChecklist } from './checklist';

// =============================================================================
// Mock supabase builder
// =============================================================================
//
// Same shape as queries.test.ts: per-table response queue, fluent chain
// returns the builder, terminal resolution (await or .maybeSingle()) pulls
// the next response from the table's queue. Extended with .like() and .lt()
// for checklist-specific predicates.

interface MockResponse {
  data: unknown;
  error: unknown;
}

function buildMockClient(tableResponses: Record<string, MockResponse[]>): {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
} {
  const queues: Record<string, MockResponse[]> = { ...tableResponses };

  const fromMock = vi.fn((table: string) => {
    const dequeue = (): Promise<MockResponse> => {
      const queue = queues[table] ?? [];
      const next = queue.shift() ?? { data: null, error: null };
      return Promise.resolve(next);
    };

    const builder: Record<string, ReturnType<typeof vi.fn>> & {
      then?: (
        onFulfilled: (value: MockResponse) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise<unknown>;
    } = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      lte: vi.fn(),
      gte: vi.fn(),
      lt: vi.fn(),
      gt: vi.fn(),
      like: vi.fn(),
      ilike: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn()
    };
    for (const fn of [
      'select',
      'eq',
      'in',
      'lte',
      'gte',
      'lt',
      'gt',
      'like',
      'ilike',
      'order',
      'limit'
    ] as const) {
      builder[fn].mockReturnValue(builder);
    }
    builder.maybeSingle.mockImplementation(() => dequeue());
    builder.then = (onFulfilled, onRejected) =>
      dequeue().then(onFulfilled, onRejected);

    return builder;
  });

  return { from: fromMock, rpc: vi.fn() };
}

// =============================================================================
// Test fixtures
// =============================================================================

const PERIOD_KEY = '2027-01';
// Last day of 2027-01 = 2027-01-31. lastDayOfMonthlyPeriod() in checklist.ts
// produces this same string and uses it as the as-of bound for closing balances.

const periodOpen = {
  period_key: PERIOD_KEY,
  period_type: 'month',
  status: 'open',
  locked_at: null,
  locked_by: null,
  created_at: '2027-01-01T00:00:00Z'
};

const periodSoftLocked = {
  period_key: PERIOD_KEY,
  period_type: 'month',
  status: 'soft_locked',
  locked_at: '2027-02-05T10:00:00Z',
  locked_by: 'staff-uuid',
  created_at: '2027-01-01T00:00:00Z'
};

const periodHardLocked = {
  period_key: PERIOD_KEY,
  period_type: 'month',
  status: 'hard_locked',
  locked_at: '2027-02-10T10:00:00Z',
  locked_by: 'staff-uuid',
  created_at: '2027-01-01T00:00:00Z'
};

/**
 * Per-table dequeue order observed by debug instrumentation. Items are read
 * sequentially in the checklist composition; queues are built to match.
 *
 * For a period NOT covered by the Phase 0 fixture (manual_pending on item 2
 * → no 2610 ledger query):
 *   periods:               [getPeriodRow]
 *   journal_lines:         [item1 TB, item3 5351, item4 5590, item5 2351,
 *                           item6 5410-UN, item6 5410-EP, item7 2630, item8 5710-*]
 *   accounts:              [item4 5590, item5 2351, item6 UN, item6 EP, item7 2630]
 *   wallet_transactions:   [item3 per-user balance_after_cents AS OF asOf]
 *   wallets:               [item9 lt(0) check]
 *   journal_entries:       [item4 cart-receipts C.1/C.2 lookup (PR D),
 *                           item4 release lookup (skipped when no candidates),
 *                           item8 P.1/P.3 lookup, item8 H.1+override_type lookup,
 *                           getEntriesPostedSince]
 *   orders:                [item4 candidate orders (skipped when no cart receipts)]
 *
 * For a period IN the Phase 0 fixture (item 2 queries 2610 ledger):
 *   journal_lines insertion order shifts — item 2's ledger query lands
 *   between item 1 TB and item 3's 5351 lines (index 1 in journal_lines).
 *   accounts gains an extra leading entry for the 2610 ledger.
 */

const accountRow2610 = {
  code: '2610',
  name_lv: 'Swedbank',
  name_en: 'Swedbank',
  type: 'asset',
  is_vat: false,
  is_active: true,
  parent_code: null,
  created_at: '2025-01-01T00:00:00Z'
};

const accountRow5590 = {
  code: '5590',
  name_lv: 'Suspense',
  name_en: 'Suspense',
  type: 'liability',
  is_vat: false,
  is_active: true,
  parent_code: null,
  created_at: '2025-01-01T00:00:00Z'
};

const accountRow2351 = {
  code: '2351',
  name_lv: 'Refund clearing',
  name_en: 'Refund clearing',
  type: 'asset',
  is_vat: false,
  is_active: true,
  parent_code: null,
  created_at: '2025-01-01T00:00:00Z'
};

const accountRow5410UN = {
  code: '5410-UN',
  name_lv: 'Accruals UN',
  name_en: 'Accruals UN',
  type: 'liability',
  is_vat: false,
  is_active: true,
  parent_code: '5410',
  created_at: '2025-01-01T00:00:00Z'
};

const accountRow5410EP = {
  code: '5410-EP',
  name_lv: 'Accruals EP',
  name_en: 'Accruals EP',
  type: 'liability',
  is_vat: false,
  is_active: true,
  parent_code: '5410',
  created_at: '2025-01-01T00:00:00Z'
};

const accountRow2630 = {
  code: '2630',
  name_lv: 'EveryPay clearing',
  name_en: 'EveryPay clearing',
  type: 'asset',
  is_vat: false,
  is_active: true,
  parent_code: null,
  created_at: '2025-01-01T00:00:00Z'
};

/**
 * Empty journal_lines response — produces opening=0, closing=0 for any
 * getAccountLedger call. Used to short-circuit items 4-7 to "pass".
 */
const emptyLines = { data: [], error: null };

/**
 * Standard "all gates pass with no VAT activity" fixture for an arbitrary
 * period (defaults to PERIOD_KEY = '2027-01'; not in Phase 0 fixture so item
 * 2 returns manual_pending). Caller passes `period`.
 */
function buildHappyPathQueues(
  period: typeof periodOpen | typeof periodSoftLocked | typeof periodHardLocked
): Record<string, MockResponse[]> {
  const isPhase0Period = /^2025-(0[7-9]|1[0-2])$|^2026-0[1-3]$/.test(
    period.period_key
  );

  // Item 2 queries 2610 ledger only when period is in Phase 0 fixture.
  // Otherwise item 2 returns manual_pending and skips both the accounts
  // and journal_lines reads for 2610.
  const item2LedgerJournalLines: MockResponse[] = isPhase0Period
    ? [emptyLines]
    : [];
  const item2LedgerAccounts: MockResponse[] = isPhase0Period
    ? [{ data: accountRow2610, error: null }]
    : [];

  return {
    periods: [{ data: period, error: null }],
    journal_lines: [
      // Item 1 trial balance — empty so it's trivially balanced (Σ=0).
      emptyLines,
      // Item 2 ledger 2610 (Phase 0 period only).
      ...item2LedgerJournalLines,
      // Item 3 wallet integrity 5351 lines.
      { data: [], error: null },
      // Item 4 ledger 5590.
      emptyLines,
      // Item 5 ledger 2351.
      emptyLines,
      // Item 6 ledger 5410-UN.
      emptyLines,
      // Item 6 ledger 5410-EP.
      emptyLines,
      // Item 7 ledger 2630.
      emptyLines,
      // Item 8 5710-* movement check.
      { data: [], error: null }
    ],
    accounts: [
      // Item 2 ledger 2610 account load (Phase 0 period only). Item 1 trial
      // balance skips accounts entirely when no lines aggregate.
      ...item2LedgerAccounts,
      // Items 4-7 ledger account loads: 5590, 2351, 5410-UN, 5410-EP, 2630.
      { data: accountRow5590, error: null },
      { data: accountRow2351, error: null },
      { data: accountRow5410UN, error: null },
      { data: accountRow5410EP, error: null },
      { data: accountRow2630, error: null }
    ],
    wallet_transactions: [
      // Item 3 per-user balance_after_cents lookup (period-scoped).
      { data: [], error: null }
    ],
    wallets: [
      // Item 9 negative-balance check.
      { data: [], error: null }
    ],
    counterparties: [
      // Item 3 only fires this when GL has counterparty_id rows; default unused.
      { data: [], error: null }
    ],
    public_profiles: [
      { data: [], error: null }
    ],
    journal_entries: [
      // Item 4 cart-receipts (C.1/C.2) lookup (PR D) — empty in the happy
      // path. When empty, getInFlightCartReceiptsTotal short-circuits and
      // does not issue the orders SELECT or the releases SELECT.
      { data: [], error: null },
      // Item 8 P.1/P.3 lookup — empty (no consolidation, no movement → NA).
      { data: [], error: null },
      // Item 8 H.1+override_type=historical_filing_alignment lookup — empty.
      { data: [], error: null },
      // getEntriesPostedSince — only called when status=soft_locked. Default
      // empty so a soft_locked period passes the can_hard_lock gate.
      { data: [], error: null }
    ],
    // Item 4 candidate orders (PR D). Only consulted when journal_entries[0]
    // (cart-receipts) returns non-empty. Default empty for the happy path.
    orders: [
      { data: [], error: null }
    ]
  };
}

/**
 * Mock GL lines for account 2610 producing the given closing balance via a
 * single H.1 historical-debit line. Used in `can_soft_lock` / `can_hard_lock`
 * test blocks to set up Phase 0 bank state matching the Phase 0 fixture.
 */
function buildPhase0Bank2610Lines(closingCents: number): MockResponse {
  return {
    data: [
      {
        id: 'l1',
        entry_id: 'e1',
        line_number: 1,
        account_code: '2610',
        debit_cents: closingCents,
        credit_cents: 0,
        currency: 'EUR',
        fx_rate_snapshot: null,
        vat_rate_snapshot: null,
        vat_country: null,
        counterparty_type: null,
        counterparty_id: null,
        narrative: null,
        journal_entries: {
          id: 'e1',
          posting_date: '2025-07-15',
          accounting_period: '2025-07',
          tax_period: '2025-07',
          entry_type: 'manual',
          type_id: 'H.1',
          source_doc_type: 'historical',
          source_doc_id: 'h1',
          reverses_entry_id: null,
          correction_reason: null,
          narrative: 'opening',
          posting_context: {},
          created_by: 'test',
          created_at: '2025-07-15T00:00:00Z',
          period_close_adjustment: false
        }
      }
    ],
    error: null
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// Top-level shape + period-key validation
// =============================================================================

describe('getPeriodCloseChecklist — period-key validation', () => {
  it('throws on a non-monthly period_key (quarterly placeholder)', async () => {
    const client = buildMockClient({});
    await expect(
      getPeriodCloseChecklist(client as never, '2026-Q2')
    ).rejects.toThrow(/not a monthly period/);
  });

  it('throws on a malformed period_key', async () => {
    const client = buildMockClient({});
    await expect(
      getPeriodCloseChecklist(client as never, '2026/01')
    ).rejects.toThrow(/not a monthly period/);
  });

  it('throws when the period row does not exist (period not seeded)', async () => {
    const client = buildMockClient({
      periods: [{ data: null, error: null }]
    });
    await expect(
      getPeriodCloseChecklist(client as never, '1999-01')
    ).rejects.toThrow(/period 1999-01 not found/);
  });
});

// =============================================================================
// Item-level transitions
// =============================================================================

describe('getPeriodCloseChecklist — item 1 (Σ debits = Σ credits)', () => {
  it('passes when trial balance is balanced (empty GL)', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item1 = result.items.find((i) => i.id === 1);
    expect(item1?.status).toBe('pass');
  });

  it('fails when trial balance is unbalanced', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    queues.journal_lines[0] = {
      // Synthetic corruption: 1000 debit, 800 credit.
      data: [
        {
          account_code: '2610',
          debit_cents: 1000,
          credit_cents: 0,
          journal_entries: { posting_date: '2027-01-10', posting_context: {} }
        },
        {
          account_code: '5351',
          debit_cents: 0,
          credit_cents: 800,
          journal_entries: { posting_date: '2027-01-10', posting_context: {} }
        }
      ],
      error: null
    };
    // Trial balance now has lines, so it queries accounts. Insert that response
    // before the existing accounts queue.
    queues.accounts.unshift({
      data: [
        { code: '2610', name_lv: 'B', name_en: 'B', type: 'asset' },
        { code: '5351', name_lv: 'W', name_en: 'W', type: 'liability' }
      ],
      error: null
    });

    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item1 = result.items.find((i) => i.id === 1);
    expect(item1?.status).toBe('fail');
    expect(item1?.detail).toMatch(/Imbalance/);
    expect(item1?.drillDownHref).toBe('/staff/accounting/trial-balance');
  });
});

describe('getPeriodCloseChecklist — item 2 (bank reconciliation)', () => {
  it('returns manual_pending for a period not in the Phase 0 fixture', async () => {
    // 2027-01 is post-Phase-0; getPhase0BankCloseForPeriod returns null.
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item2 = result.items.find((i) => i.id === 2);
    expect(item2?.status).toBe('manual_pending');
    expect(item2?.detail).toMatch(/PR #4b/);
  });

  it('passes when GL 2610 closing matches the Phase 0 fixture', async () => {
    // 2025-07 expects 5100 cents.
    const queues = buildHappyPathQueues({
      ...periodOpen,
      period_key: '2025-07'
    });
    // Item 2 ledger 2610: produce closing = 5100 via a single +5100 line
    // dated before the period (so it lands in opening_balance, but
    // closing = opening + 0 in-range = 5100 ✓ — actually we need it AT
    // or before 2025-07-31 inclusive, so dating it 2025-07-15 puts it
    // in-range). Either way closing_balance_cents will be 5100.
    queues.journal_lines[1] = {
      data: [
        {
          id: 'l1',
          entry_id: 'e1',
          line_number: 1,
          account_code: '2610',
          debit_cents: 5100,
          credit_cents: 0,
          currency: 'EUR',
          fx_rate_snapshot: null,
          vat_rate_snapshot: null,
          vat_country: null,
          counterparty_type: null,
          counterparty_id: null,
          narrative: null,
          journal_entries: {
            id: 'e1',
            posting_date: '2025-07-15',
            accounting_period: '2025-07',
            tax_period: '2025-07',
            entry_type: 'manual',
            type_id: 'H.1',
            source_doc_type: 'historical',
            source_doc_id: 'h1',
            reverses_entry_id: null,
            correction_reason: null,
            narrative: 'opening',
            posting_context: {},
            created_by: 'test',
            created_at: '2025-07-15T00:00:00Z',
            period_close_adjustment: false
          }
        }
      ],
      error: null
    };

    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, '2025-07');
    const item2 = result.items.find((i) => i.id === 2);
    expect(item2?.status).toBe('pass');
    expect(item2?.detail).toMatch(/matches Swedbank/);
  });

  it('fails when GL 2610 closing diverges from the Phase 0 fixture', async () => {
    const queues = buildHappyPathQueues({
      ...periodOpen,
      period_key: '2025-07'
    });
    // Closing = 1234 ≠ expected 5100.
    queues.journal_lines[1] = {
      data: [
        {
          id: 'l1',
          entry_id: 'e1',
          line_number: 1,
          account_code: '2610',
          debit_cents: 1234,
          credit_cents: 0,
          currency: 'EUR',
          fx_rate_snapshot: null,
          vat_rate_snapshot: null,
          vat_country: null,
          counterparty_type: null,
          counterparty_id: null,
          narrative: null,
          journal_entries: {
            id: 'e1',
            posting_date: '2025-07-15',
            accounting_period: '2025-07',
            tax_period: '2025-07',
            entry_type: 'manual',
            type_id: 'H.1',
            source_doc_type: 'historical',
            source_doc_id: 'h1',
            reverses_entry_id: null,
            correction_reason: null,
            narrative: 'corrupt',
            posting_context: {},
            created_by: 'test',
            created_at: '2025-07-15T00:00:00Z',
            period_close_adjustment: false
          }
        }
      ],
      error: null
    };

    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, '2025-07');
    const item2 = result.items.find((i) => i.id === 2);
    expect(item2?.status).toBe('fail');
    expect(item2?.detail).toMatch(/delta/);
  });
});

describe('getPeriodCloseChecklist — item 3 (wallet integrity)', () => {
  it('passes when GL 5351 = 0 and wallets table = 0 (Phase 0 default)', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item3 = result.items.find((i) => i.id === 3);
    expect(item3?.status).toBe('pass');
  });

  it('fails when GL 5351 has unattributed lines', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    // periodOpen.period_key = 2027-01 (manual_pending on item 2 → no 2610
    // ledger query). journal_lines indices: [0]=item1 TB, [1]=item3 5351.
    queues.journal_lines[1] = {
      data: [
        { debit_cents: 0, credit_cents: 1000, counterparty_id: null }
      ],
      error: null
    };
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item3 = result.items.find((i) => i.id === 3);
    expect(item3?.status).toBe('fail');
    expect(item3?.detail).toMatch(/unattributed/);
  });
});

describe('getPeriodCloseChecklist — items 4-7 (single-account closing = 0)', () => {
  it('passes all four when 5590, 2351, 5410-*, 2630 closing balances are zero', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    expect(result.items.find((i) => i.id === 4)?.status).toBe('pass');
    expect(result.items.find((i) => i.id === 5)?.status).toBe('pass');
    expect(result.items.find((i) => i.id === 6)?.status).toBe('pass');
    expect(result.items.find((i) => i.id === 7)?.status).toBe('pass');
  });

  it('fails item 4 when 5590 closing != 0', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    // periodOpen.period_key = 2027-01 (item 2 is manual_pending, no 2610 query).
    // journal_lines indices: [0]=item1 TB, [1]=item3 5351, [2]=5590,
    // [3]=2351, [4]=5410-UN, [5]=5410-EP, [6]=2630, [7]=item8 5710-*.
    queues.journal_lines[2] = {
      data: [
        {
          id: 'l',
          entry_id: 'e',
          line_number: 1,
          account_code: '5590',
          debit_cents: 0,
          credit_cents: 500,
          currency: 'EUR',
          fx_rate_snapshot: null,
          vat_rate_snapshot: null,
          vat_country: null,
          counterparty_type: null,
          counterparty_id: null,
          narrative: null,
          journal_entries: {
            id: 'e',
            posting_date: '2027-01-15',
            accounting_period: '2027-01',
            tax_period: '2027-01',
            entry_type: 'manual',
            type_id: 'H.1',
            source_doc_type: 'h',
            source_doc_id: 'h',
            reverses_entry_id: null,
            correction_reason: null,
            narrative: 'unmatched',
            posting_context: {},
            created_by: 'test',
            created_at: '2027-01-15T00:00:00Z',
            period_close_adjustment: false
          }
        }
      ],
      error: null
    };
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('fail');
    // PR D reworded the detail from "5590 closing balance ..." to
    // "5590 holds ... in suspense, over/under-states expected ...".
    expect(item4?.detail).toMatch(/in suspense/);
    expect(item4?.detail).toMatch(/over-states|under-states/);
  });

  // PR D — Item 4 reconciliation gate. The existing fail test above asserts
  // the legacy "5590 != 0" failure path; it continues to pass because the
  // new gate also fails when balance != expected (and expected = 0 with no
  // in-flight C.1/C.2 in the happy queue). The T1–T11 block below covers
  // the new reconciliation semantics directly.

  it('fails item 6 when sum of 5410-* closing balances != 0', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    // 2027-01 indices: [4]=5410-UN, [5]=5410-EP. Put a non-zero on UN; EP
    // stays empty so the sum is non-zero (= -200 net debit).
    queues.journal_lines[4] = {
      data: [
        {
          id: 'l',
          entry_id: 'e',
          line_number: 1,
          account_code: '5410-UN',
          debit_cents: 0,
          credit_cents: 200,
          currency: 'EUR',
          fx_rate_snapshot: null,
          vat_rate_snapshot: null,
          vat_country: null,
          counterparty_type: null,
          counterparty_id: null,
          narrative: null,
          journal_entries: {
            id: 'e',
            posting_date: '2027-01-15',
            accounting_period: '2027-01',
            tax_period: '2027-01',
            entry_type: 'accrual',
            type_id: 'H.1',
            source_doc_type: 'h',
            source_doc_id: 'h',
            reverses_entry_id: null,
            correction_reason: null,
            narrative: 'pending accrual',
            posting_context: {},
            created_by: 'test',
            created_at: '2027-01-15T00:00:00Z',
            period_close_adjustment: false
          }
        }
      ],
      error: null
    };
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item6 = result.items.find((i) => i.id === 6);
    expect(item6?.status).toBe('fail');
    expect(item6?.detail).toMatch(/5410-\*/);
  });
});

// =============================================================================
// PR D — Item 4 reconciliation gate (T1–T11)
// =============================================================================
//
// Covers the new buildItem4 semantics that replaced "5590 closing = 0" with
// "5590 closing = expected_in_flight_total". Each scenario sets up a specific
// combination of journal_entries C.1/C.2 + orders rows + journal_entries
// release rows + journal_lines 5590 ledger so the gate either passes
// (balance == expected) or fails (with the new descriptive failure detail).

// -----------------------------------------------------------------------------
// Helper — build a 5590 journal_line for a given net credit balance
// -----------------------------------------------------------------------------
//
// Item 4 calls getAccountClosingBalance(supabase, '5590', asOf) which under
// the hood loads journal_lines + the 5590 account row, and computes the
// signed net-debit-cents closing balance. To set up a specific 5590 balance,
// we install a single Cr 5590 line of the desired magnitude. (Net-debit
// convention: a credit line produces a negative closing balance; suspense
// 5590 carries credit balance during in-flight cart periods.)

function buildSuspenseCreditLine(closingCreditCents: number) {
  return {
    id: 'l-5590',
    entry_id: 'e-5590',
    line_number: 1,
    account_code: '5590',
    debit_cents: 0,
    credit_cents: closingCreditCents,
    currency: 'EUR',
    fx_rate_snapshot: null,
    vat_rate_snapshot: null,
    vat_country: null,
    counterparty_type: null,
    counterparty_id: null,
    narrative: null,
    journal_entries: {
      id: 'e-5590',
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      entry_type: 'checkout',
      type_id: 'C.1',
      source_doc_type: 'cart_payment',
      source_doc_id: 'cart-group-1',
      reverses_entry_id: null,
      correction_reason: null,
      narrative: 'cart payment',
      posting_context: {},
      created_by: 'test',
      created_at: '2027-01-15T00:00:00Z',
      period_close_adjustment: false
    }
  };
}

/**
 * Set up an in-flight cart scenario by mutating the queue. Splices in the
 * PR D-introduced journal_entries[1] release-lookup response and overrides
 * orders[0] and journal_entries[0]. Net 5590 closing balance is installed
 * separately via journal_lines[2] (item 4 5590 ledger query).
 */
function setupInFlightCarts(
  queues: ReturnType<typeof buildHappyPathQueues>,
  opts: {
    cartReceipts: Array<{ source_doc_id: string }>;
    orders: Array<{
      id: string;
      items_total_cents: number;
      shipping_cost_cents: number;
      cart_group_id: string;
    }>;
    releases?: Array<{
      source_doc_id: string;
      type_id: string;
      posting_context?: Record<string, unknown>;
    }>;
    /** Net Cr 5590 closing balance (cents). Defaults to sum of order gross_carts. */
    suspenseCreditCents?: number;
  }
) {
  // getInFlightCartReceiptsTotal reads the cart_group_id from
  // posting_context.cart_payment_id (canonical across live + backfill), so
  // project the test's source_doc_id input into that shape. (Test inputs keep
  // source_doc_id for readability; the cart-group id value is identical.)
  queues.journal_entries[0] = {
    data: opts.cartReceipts.map((r) => ({ posting_context: { cart_payment_id: r.source_doc_id } })),
    error: null
  };

  // When cart receipts are non-empty, the release lookup fires AFTER the
  // orders SELECT and BEFORE item 8's queries. Splice the release response
  // in at index 1.
  const releaseRows = (opts.releases ?? []).map((r) => ({
    source_doc_id: r.source_doc_id,
    type_id: r.type_id,
    posting_context: r.posting_context ?? {}
  }));
  queues.journal_entries.splice(1, 0, { data: releaseRows, error: null });

  queues.orders![0] = { data: opts.orders, error: null };

  const totalGross = opts.orders.reduce(
    (s, o) => s + o.items_total_cents + o.shipping_cost_cents,
    0
  );
  const suspense = opts.suspenseCreditCents ?? totalGross;
  if (suspense > 0) {
    queues.journal_lines[2] = { data: [buildSuspenseCreditLine(suspense)], error: null };
  }
}

describe('getPeriodCloseChecklist — item 4 reconciliation gate (PR D)', () => {
  // T1 — Empty in-flight (no C.1/C.2 in GL). Trivial-pass property:
  // pre-cutover behavior with the new gate must remain a clean pass.
  it('T1: passes when there are no C.1/C.2 entries and 5590 balance is zero', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('pass');
    expect(item4?.label).toBe('Suspense reconciled (5590)');
    expect(item4?.detail).toContain('no in-flight cart receipts');
  });

  // T2 — One in-flight cart, no completion yet. Single-seller cart, single
  // order, balance matches gross_cart.
  it('T2: passes with one in-flight cart matching its 5590 contribution', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    setupInFlightCarts(queues, {
      cartReceipts: [{ source_doc_id: 'cart-group-1' }],
      orders: [
        {
          id: 'order-1',
          items_total_cents: 5000,
          shipping_cost_cents: 350,
          cart_group_id: 'cart-group-1'
        }
      ]
    });
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('pass');
    expect(item4?.detail).toMatch(/matching expected in-flight cart receipts/);
  });

  // T3 — Multiple in-flight carts (different sellers, different carts).
  it('T3: passes with multiple in-flight carts summing to total 5590 balance', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    setupInFlightCarts(queues, {
      cartReceipts: [
        { source_doc_id: 'cart-group-A' },
        { source_doc_id: 'cart-group-B' }
      ],
      orders: [
        { id: 'order-A1', items_total_cents: 4000, shipping_cost_cents: 350, cart_group_id: 'cart-group-A' },
        { id: 'order-B1', items_total_cents: 6500, shipping_cost_cents: 350, cart_group_id: 'cart-group-B' }
      ]
    });
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('pass');
  });

  // T4 — Partial fulfillment cart: kept-portion-only orders exist in DB
  // (the unavailable portion never produced an order row). GL's 5590
  // closing already reflects only kept-portion suspense because the C.9
  // emit fired at fulfillment for the unavailable portion.
  it('T4: passes when partial-fulfillment cart shows only kept-portion orders', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    setupInFlightCarts(queues, {
      cartReceipts: [{ source_doc_id: 'cart-group-partial' }],
      orders: [
        {
          id: 'order-kept',
          items_total_cents: 5000,
          shipping_cost_cents: 350,
          cart_group_id: 'cart-group-partial'
        }
        // The unavailable seller's order was never created; refunded portion
        // was reversed by C.9 (not modeled here — assume it's reflected in
        // the actual 5590 balance which only carries the kept-portion gross).
      ]
    });
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('pass');
  });

  // T5 — Buyer-wallet contribution: cart total = €100, paid €70 EveryPay +
  // €30 wallet. Under PR C commit 9 Option α the C.1 entry credits 5590 by
  // the FULL cart total (€100, not just €70). Expected_in_flight matches
  // because orders.items_total + shipping = full cart.
  it('T5: passes when buyer-wallet cart has 5590 = full cart total (not EveryPay portion)', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    setupInFlightCarts(queues, {
      cartReceipts: [{ source_doc_id: 'cart-wallet' }],
      orders: [
        {
          id: 'order-wallet',
          items_total_cents: 9500,
          shipping_cost_cents: 350,
          cart_group_id: 'cart-wallet'
        }
      ],
      // Suspense holds 9850 (full cart_total) per Q3 Option α — buyer wallet
      // portion is Dr 5351-buyer at C.1 time, not deducted from 5590.
      suspenseCreditCents: 9850
    });
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('pass');
  });

  // T6 — Period-boundary straddling. Two assertions: (a) at the in-flight
  // period end, the order contributes; (b) after release in next period,
  // it doesn't. We only model (a) here — for (b) we'd need separate test
  // setup with the release entry's posting_date <= asOf. Combined into one
  // describe block as two distinct `it` cases.
  it('T6a: order paid in N but not yet released is in-flight at end-of-N', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    setupInFlightCarts(queues, {
      cartReceipts: [{ source_doc_id: 'cart-straddle' }],
      orders: [
        {
          id: 'order-straddle',
          items_total_cents: 7500,
          shipping_cost_cents: 350,
          cart_group_id: 'cart-straddle'
        }
      ]
      // No release entry → asOf check before completion → contributes.
    });
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('pass');
  });

  it('T6b: order released by asOf does not contribute (passes with 5590=0)', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    setupInFlightCarts(queues, {
      cartReceipts: [{ source_doc_id: 'cart-released' }],
      orders: [
        {
          id: 'order-released',
          items_total_cents: 7500,
          shipping_cost_cents: 350,
          cart_group_id: 'cart-released'
        }
      ],
      releases: [{ source_doc_id: 'order-released', type_id: 'O.1' }],
      suspenseCreditCents: 0  // Released — 5590 closing back to zero.
    });
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('pass');
  });

  // T7 — Multi-seller cart, one order completed and one in-flight. Only
  // the remaining order contributes; the completed order is excluded via
  // its O.1–O.5 release entry.
  it('T7: multi-seller cart with one completed + one in-flight contributes only the in-flight order', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    setupInFlightCarts(queues, {
      cartReceipts: [{ source_doc_id: 'cart-multi' }],
      orders: [
        { id: 'order-done', items_total_cents: 4000, shipping_cost_cents: 350, cart_group_id: 'cart-multi' },
        { id: 'order-pending', items_total_cents: 6500, shipping_cost_cents: 350, cart_group_id: 'cart-multi' }
      ],
      releases: [{ source_doc_id: 'order-done', type_id: 'O.3' }],
      // Only order-pending contributes: 6500 + 350 = 6850
      suspenseCreditCents: 6850
    });
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('pass');
  });

  // T8 — Order with O.9 partial refund: contribution = gross_cart − refund.
  // 5590 closing reflects same amount because the O.9 Dr 5590 already
  // released the partial-refund portion.
  it('T8: order with O.9 partial refund contributes gross_cart minus refund_cents', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    setupInFlightCarts(queues, {
      cartReceipts: [{ source_doc_id: 'cart-partial-refund' }],
      orders: [
        {
          id: 'order-partial',
          items_total_cents: 10000,
          shipping_cost_cents: 350,
          cart_group_id: 'cart-partial-refund'
        }
      ],
      releases: [
        {
          source_doc_id: 'order-partial',
          type_id: 'O.9',
          posting_context: { refund_cents: 3000 }
        }
      ],
      // 10350 gross - 3000 refunded = 7350 expected. Matching 5590 closing.
      suspenseCreditCents: 7350
    });
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('pass');
  });

  // T9 — Orphan / drift failure: balance ≠ expected. Verifies the failure
  // detail names the delta direction and lists plausible causes.
  it('T9: fails with descriptive detail when 5590 over-states expected (orphan completion drift)', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    setupInFlightCarts(queues, {
      cartReceipts: [{ source_doc_id: 'cart-drift' }],
      orders: [
        {
          id: 'order-drift',
          items_total_cents: 5000,
          shipping_cost_cents: 350,
          cart_group_id: 'cart-drift'
        }
      ],
      // Expected = 5350; GL holds 8000 (orphan completion drift — synthetic).
      suspenseCreditCents: 8000
    });
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('fail');
    expect(item4?.detail).toMatch(/over-states/);
    expect(item4?.detail).toMatch(/orphan completion/);
    expect(item4?.detail).toMatch(/€53\.50/);  // expected
    expect(item4?.detail).toMatch(/€80\.00/);  // balance
    expect(item4?.detail).toMatch(/€26\.50/);  // delta
  });

  // T10 — Cancelled-pre-refund order (status=cancelled but no O.7/8/9 yet):
  // the GL-driven predicate keeps it in expected_in_flight because there's
  // no release entry. 5590 still holds the suspense. Reconciled.
  it('T10: cancelled-pre-refund order keeps contributing until refund-side release entry posts', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    setupInFlightCarts(queues, {
      cartReceipts: [{ source_doc_id: 'cart-cancelled' }],
      orders: [
        {
          id: 'order-cancelled',
          items_total_cents: 5000,
          shipping_cost_cents: 350,
          cart_group_id: 'cart-cancelled'
        }
      ]
      // No release entry — even if orders.status='cancelled', no O.7/8/9 has
      // fired yet, so the predicate counts it as in-flight.
    });
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('pass');
  });

  // T11 — Wallet-only cart (no C.1/C.2 antecedent): cart-wallet-pay route
  // bypasses fulfillCartPayment entirely. The order exists but has no GL
  // backing; predicate excludes it from expected_in_flight via the cart-
  // receipt EXISTS check. 5590 balance is unchanged (zero).
  it('T11: wallet-only cart (no C.1/C.2) is excluded from expected_in_flight', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    // No cart-receipts in GL → getInFlightCartReceiptsTotal short-circuits
    // to 0 without ever querying orders. journal_entries[0] stays empty per
    // the happy-path baseline. 5590 closing stays at 0.
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item4 = result.items.find((i) => i.id === 4);
    expect(item4?.status).toBe('pass');
    expect(item4?.detail).toContain('no in-flight cart receipts');
  });
});


describe('getPeriodCloseChecklist — item 8 (VAT consolidation)', () => {
  it('returns not_applicable when no 5710-* movement and no consolidation entry', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item8 = result.items.find((i) => i.id === 8);
    expect(item8?.status).toBe('not_applicable');
  });

  it('passes when a P.1 consolidation entry exists for the period', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    // Index 1 since PR D's item-4 cart-receipts query occupies [0].
    queues.journal_entries[1] = {
      data: [{ id: 'p1-uuid', type_id: 'P.1' }],
      error: null
    };
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item8 = result.items.find((i) => i.id === 8);
    expect(item8?.status).toBe('pass');
  });

  it('passes when an H.1 historical-filing-alignment entry exists for the period (PR #4.5a.1)', async () => {
    // Phase 0's December 2025 PVN deklarācija RC catch-up is structurally a
    // period-level VAT consolidation but routes through the H.1 historical
    // override family rather than P.1. The override_type filter on item 8's
    // H.1 query is applied server-side; the mock simulates that by returning
    // only matching rows on journal_entries[2] (index shifted +1 by PR D's
    // item-4 cart-receipts query at [0]).
    const queues = buildHappyPathQueues(periodOpen);
    queues.journal_entries[2] = {
      data: [{ id: 'h1-uuid', type_id: 'H.1' }],
      error: null
    };
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item8 = result.items.find((i) => i.id === 8);
    expect(item8?.status).toBe('pass');
  });

  it('fails when 5710-* movement exists but no consolidation entry', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    // 2027-01 indices: [7] = item8 5710-* movement check.
    queues.journal_lines[7] = {
      data: [
        {
          account_code: '5710-LV-IN',
          journal_entries: { accounting_period: PERIOD_KEY }
        }
      ],
      error: null
    };
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item8 = result.items.find((i) => i.id === 8);
    expect(item8?.status).toBe('fail');
    expect(item8?.detail).toMatch(/no P\.1 \/ P\.3 \/ H\.1 consolidation/);
  });
});

describe('getPeriodCloseChecklist — item 9 (wallets non-negative)', () => {
  it('passes when no wallets have negative balances', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item9 = result.items.find((i) => i.id === 9);
    expect(item9?.status).toBe('pass');
  });

  it('fails when one or more wallets have negative balances', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    // wallets queue: [0] = item 9 (lt 0 filter); item 3 now reads
    // wallet_transactions, not wallets.
    queues.wallets[0] = {
      data: [
        { user_id: 'user-1', balance_cents: -500 },
        { user_id: 'user-2', balance_cents: -100 }
      ],
      error: null
    };
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item9 = result.items.find((i) => i.id === 9);
    expect(item9?.status).toBe('fail');
    expect(item9?.detail).toMatch(/2 wallets/);
  });
});

// =============================================================================
// Gating logic — the safety invariants
// =============================================================================

describe('getPeriodCloseChecklist — can_soft_lock', () => {
  it('is true for an open period when all items pass-or-NA', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    expect(result.period_status).toBe('open');
    expect(result.all_pass).toBe(false); // item 2 is manual_pending
    expect(result.can_soft_lock).toBe(false);
  });

  it('is true for an open period when item 2 is the only manual_pending and is replaced with pass', async () => {
    // Use 2025-07 (Phase 0 fixture defines this) with a matching ledger.
    const queues = buildHappyPathQueues({
      ...periodOpen,
      period_key: '2025-07'
    });
    // Item 2 ledger 2610: closing = 5100 (matches fixture).
    queues.journal_lines[1] = buildPhase0Bank2610Lines(5100);

    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, '2025-07');
    expect(result.all_pass).toBe(true);
    expect(result.can_soft_lock).toBe(true);
  });

  it('is false when any item fails', async () => {
    const queues = buildHappyPathQueues({
      ...periodOpen,
      period_key: '2025-07'
    });
    // Use the Phase-0-matching ledger so item 2 passes...
    queues.journal_lines[1] = buildPhase0Bank2610Lines(5100);
    // ...but break item 9 (negative wallet). wallets[0] is now item 9's
    // lt(0) check (item 3 reads wallet_transactions, not wallets).
    queues.wallets[0] = {
      data: [{ user_id: 'u', balance_cents: -100 }],
      error: null
    };

    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, '2025-07');
    expect(result.all_pass).toBe(false);
    expect(result.can_soft_lock).toBe(false);
  });

  it('is false even with all_pass=true if status is not open', async () => {
    const queues = buildHappyPathQueues({
      ...periodSoftLocked,
      period_key: '2025-07'
    });
    // Phase-0-matching ledger so item 2 passes; the rest are pass/NA.
    queues.journal_lines[1] = buildPhase0Bank2610Lines(5100);

    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, '2025-07');
    expect(result.period_status).toBe('soft_locked');
    expect(result.all_pass).toBe(true);
    expect(result.can_soft_lock).toBe(false); // not 'open'
  });
});

describe('getPeriodCloseChecklist — can_hard_lock', () => {
  it('is true when status=soft_locked and no entries posted since locked_at', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodSoftLocked));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    expect(result.period_status).toBe('soft_locked');
    expect(result.can_hard_lock).toBe(true);
  });

  it('is false when entries were posted since locked_at', async () => {
    const queues = buildHappyPathQueues(periodSoftLocked);
    // getEntriesPostedSince — last journal_entries response.
    // Index 3 since PR D's item-4 cart-receipts query occupies [0].
    queues.journal_entries[3] = {
      data: [
        {
          id: 'late-entry',
          posting_date: '2027-02-06',
          accounting_period: PERIOD_KEY,
          tax_period: PERIOD_KEY,
          entry_type: 'manual',
          type_id: 'H.1',
          source_doc_type: 'h',
          source_doc_id: 'h',
          reverses_entry_id: null,
          correction_reason: null,
          narrative: 'late',
          posting_context: {},
          created_by: 'test',
          created_at: '2027-02-06T10:00:00Z',
          period_close_adjustment: false
        }
      ],
      error: null
    };
    const client = buildMockClient(queues);
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    expect(result.can_hard_lock).toBe(false);
  });

  it('is false when status=open', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    expect(result.period_status).toBe('open');
    expect(result.can_hard_lock).toBe(false);
  });

  it('is false when status=hard_locked', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodHardLocked));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    expect(result.period_status).toBe('hard_locked');
    expect(result.can_hard_lock).toBe(false);
  });
});

describe('getPeriodCloseChecklist — can_unsoft_lock', () => {
  it('is true when status=soft_locked', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodSoftLocked));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    expect(result.can_unsoft_lock).toBe(true);
  });

  it('is false when status=open', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    expect(result.can_unsoft_lock).toBe(false);
  });

  it('is false when status=hard_locked', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodHardLocked));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    expect(result.can_unsoft_lock).toBe(false);
  });
});

// =============================================================================
// Result shape
// =============================================================================

describe('getPeriodCloseChecklist — result shape', () => {
  it('returns 9 items in id-order 1-9', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    expect(result.items).toHaveLength(9);
    expect(result.items.map((i) => i.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('echoes period_key and period_type=month', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    expect(result.period_key).toBe(PERIOD_KEY);
    expect(result.period_type).toBe('month');
  });
});
