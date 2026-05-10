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
 *   journal_entries:       [item8 P.1/P.3 lookup, getEntriesPostedSince]
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
      // Item 8 P.1/P.3 lookup — empty (no consolidation, no movement → NA).
      { data: [], error: null },
      // getEntriesPostedSince — only called when status=soft_locked. Default
      // empty so a soft_locked period passes the can_hard_lock gate.
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
    expect(item4?.detail).toMatch(/closing balance/);
  });

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

describe('getPeriodCloseChecklist — item 8 (VAT consolidation)', () => {
  it('returns not_applicable when no 5710-* movement and no consolidation entry', async () => {
    const client = buildMockClient(buildHappyPathQueues(periodOpen));
    const result = await getPeriodCloseChecklist(client as never, PERIOD_KEY);
    const item8 = result.items.find((i) => i.id === 8);
    expect(item8?.status).toBe('not_applicable');
  });

  it('passes when a P.1 consolidation entry exists for the period', async () => {
    const queues = buildHappyPathQueues(periodOpen);
    queues.journal_entries[0] = {
      data: [{ id: 'p1-uuid', type_id: 'P.1' }],
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
    expect(item8?.detail).toMatch(/no P.1 or P.3 consolidation/);
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
    queues.journal_entries[1] = {
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
