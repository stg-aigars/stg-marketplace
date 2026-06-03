/**
 * Queries module unit tests — mocked supabase (PR #4).
 *
 * Covers: trial balance aggregation + backfill filter + balance flag,
 * account ledger running balance for asset and liability, journal entry
 * detail with account-name join + imbalance flag, wallet integrity empty
 * + mismatch cases, recent entries ordering.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getAccountLedger,
  getBankClosureReconciliation,
  getEntriesPostedSince,
  getInFlightCartReceiptsTotal,
  getInTransitEverypayClearingTotal,
  getJournalEntry,
  getNetVatPositionForPeriod,
  getPeriodRow,
  getRecentJournalEntries,
  getTrialBalance,
  getWalletIntegrity,
  getWalletIntegrityAsOf
} from './queries';

// =============================================================================
// Mock supabase builder
// =============================================================================
//
// Same shape as posting-engine.test.ts: per-table response queue. Each
// from(table) call dequeues one response. The fluent chain (select/eq/in/
// lte/gte/order/limit/maybeSingle) is mocked to return the builder so any
// call order works; the terminal Promise resolution comes from the queue.

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

    // The builder is a thenable: each terminal method (.maybeSingle(), .order()
    // when used as the final call, etc.) resolves to the queued response. To
    // keep the surface simple, every chainable returns this; awaiting the
    // builder OR calling .maybeSingle() resolves to the next queued response.
    const builder: Record<string, ReturnType<typeof vi.fn>> & {
      then?: (
        onFulfilled: (value: MockResponse) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise<unknown>;
    } = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      is: vi.fn(),
      lte: vi.fn(),
      gte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn()
    };
    for (const fn of ['select', 'eq', 'in', 'is', 'lte', 'gte', 'order', 'limit'] as const) {
      builder[fn].mockReturnValue(builder);
    }
    builder.maybeSingle.mockImplementation(() => dequeue());
    // PostgREST builders are thenable. await client.from(...).select(...)... resolves the query.
    builder.then = (onFulfilled, onRejected) =>
      dequeue().then(onFulfilled, onRejected);

    return builder;
  });

  return { from: fromMock, rpc: vi.fn() };
}

// =============================================================================
// getTrialBalance
// =============================================================================

describe('getTrialBalance', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates lines per account and joins account names', async () => {
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            // 2610 (asset, bank): 1000 debit
            {
              account_code: '2610',
              debit_cents: 1000,
              credit_cents: 0,
              journal_entries: { posting_date: '2027-01-10', posting_context: {} }
            },
            // 5351 (liability, wallet): 1000 credit
            {
              account_code: '5351',
              debit_cents: 0,
              credit_cents: 1000,
              journal_entries: { posting_date: '2027-01-10', posting_context: {} }
            },
            // Second entry: 5351 partial wallet payout 300
            {
              account_code: '5351',
              debit_cents: 300,
              credit_cents: 0,
              journal_entries: { posting_date: '2027-01-15', posting_context: {} }
            },
            {
              account_code: '2610',
              debit_cents: 0,
              credit_cents: 300,
              journal_entries: { posting_date: '2027-01-15', posting_context: {} }
            }
          ],
          error: null
        }
      ],
      accounts: [
        {
          data: [
            { code: '2610', name_lv: 'Swedbank', name_en: 'Swedbank', type: 'asset' },
            { code: '5351', name_lv: 'Wallet liab', name_en: 'Wallet liab', type: 'liability' }
          ],
          error: null
        }
      ]
    });

    const tb = await getTrialBalance(client as never, '2027-01-31');

    expect(tb.as_of).toBe('2027-01-31');
    expect(tb.rows).toHaveLength(2);
    expect(tb.is_balanced).toBe(true);
    expect(tb.total_debit_cents).toBe(1300);
    expect(tb.total_credit_cents).toBe(1300);

    const bank = tb.rows.find((r) => r.account_code === '2610');
    const wallet = tb.rows.find((r) => r.account_code === '5351');

    expect(bank).toMatchObject({
      debit_cents: 1000,
      credit_cents: 300,
      net_debit_cents: 700,
      account_type: 'asset',
      account_name_en: 'Swedbank'
    });
    expect(wallet).toMatchObject({
      debit_cents: 300,
      credit_cents: 1000,
      net_debit_cents: -700,
      account_type: 'liability'
    });
  });

  it('respects includeBackfill=false by filtering posting_context.backfill rows', async () => {
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            // Live entry: 500 / 500 split
            {
              account_code: '2610',
              debit_cents: 500,
              credit_cents: 0,
              journal_entries: { posting_date: '2027-01-10', posting_context: {} }
            },
            {
              account_code: '5351',
              debit_cents: 0,
              credit_cents: 500,
              journal_entries: { posting_date: '2027-01-10', posting_context: {} }
            },
            // Backfill entry: should be filtered when includeBackfill=false.
            {
              account_code: '2610',
              debit_cents: 9000,
              credit_cents: 0,
              journal_entries: {
                posting_date: '2025-07-01',
                posting_context: { backfill: true, phase0_entry_number: 1 }
              }
            },
            {
              account_code: '3110',
              debit_cents: 0,
              credit_cents: 9000,
              journal_entries: {
                posting_date: '2025-07-01',
                posting_context: { backfill: true, phase0_entry_number: 1 }
              }
            }
          ],
          error: null
        }
      ],
      accounts: [
        {
          data: [
            { code: '2610', name_lv: 'Bank', name_en: 'Bank', type: 'asset' },
            { code: '5351', name_lv: 'Wallet', name_en: 'Wallet', type: 'liability' }
          ],
          error: null
        }
      ]
    });

    const tb = await getTrialBalance(client as never, '2027-01-31', { includeBackfill: false });

    expect(tb.rows).toHaveLength(2);
    expect(tb.rows.find((r) => r.account_code === '3110')).toBeUndefined();
    const bank = tb.rows.find((r) => r.account_code === '2610');
    expect(bank?.debit_cents).toBe(500);
    expect(tb.is_balanced).toBe(true);
  });

  it('flags is_balanced=false when totals diverge', async () => {
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            // Synthetic corruption: debit > credit. Should never happen against
            // a healthy GL but the flag must surface visually if it does.
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
        }
      ],
      accounts: [
        {
          data: [
            { code: '2610', name_lv: 'B', name_en: 'B', type: 'asset' },
            { code: '5351', name_lv: 'W', name_en: 'W', type: 'liability' }
          ],
          error: null
        }
      ]
    });

    const tb = await getTrialBalance(client as never, '2027-01-31');
    expect(tb.is_balanced).toBe(false);
    expect(tb.total_debit_cents).toBe(1000);
    expect(tb.total_credit_cents).toBe(800);
  });

  it('returns empty trial balance with is_balanced=true when no lines exist', async () => {
    const client = buildMockClient({
      journal_lines: [{ data: [], error: null }]
    });
    const tb = await getTrialBalance(client as never, '2027-01-31');
    expect(tb.rows).toEqual([]);
    expect(tb.total_debit_cents).toBe(0);
    expect(tb.total_credit_cents).toBe(0);
    expect(tb.is_balanced).toBe(true);
  });

  it('excludes posting_context.test_artifact rows by default (excludeTestArtifacts=true)', async () => {
    // Mixed data: one real entry, one test_artifact entry. Default behaviour
    // must drop the test_artifact pair from the trial balance — production
    // reporting at any "as-of" date that includes the synthetic 2027-01
    // window must not see test rows.
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            // Real production entry: 500 / 500.
            {
              account_code: '2610',
              debit_cents: 500,
              credit_cents: 0,
              journal_entries: { posting_date: '2027-04-10', posting_context: {} }
            },
            {
              account_code: '5351',
              debit_cents: 0,
              credit_cents: 500,
              journal_entries: { posting_date: '2027-04-10', posting_context: {} }
            },
            // Test artifact entry: 9999 / 9999. Must be filtered.
            {
              account_code: '2610',
              debit_cents: 9999,
              credit_cents: 0,
              journal_entries: {
                posting_date: '2027-04-15',
                posting_context: { test_artifact: true }
              }
            },
            {
              account_code: '5351',
              debit_cents: 0,
              credit_cents: 9999,
              journal_entries: {
                posting_date: '2027-04-15',
                posting_context: { test_artifact: true }
              }
            }
          ],
          error: null
        }
      ],
      accounts: [
        {
          data: [
            { code: '2610', name_lv: 'Bank', name_en: 'Bank', type: 'asset' },
            { code: '5351', name_lv: 'Wallet', name_en: 'Wallet', type: 'liability' }
          ],
          error: null
        }
      ]
    });

    const tb = await getTrialBalance(client as never, '2027-04-30');

    // Only the 500 / 500 real entry should appear; test_artifact pair excluded.
    expect(tb.rows).toHaveLength(2);
    expect(tb.total_debit_cents).toBe(500);
    expect(tb.total_credit_cents).toBe(500);
    expect(tb.is_balanced).toBe(true);
    expect(tb.rows.find((r) => r.account_code === '2610')?.debit_cents).toBe(500);
    expect(tb.rows.find((r) => r.account_code === '5351')?.credit_cents).toBe(500);
  });

  it('includes posting_context.test_artifact rows when excludeTestArtifacts=false', async () => {
    // Same data as above. Setting excludeTestArtifacts=false must include
    // the test_artifact pair so the staff entry-detail / debugging surfaces
    // can opt back in when intentionally inspecting test data.
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            {
              account_code: '2610',
              debit_cents: 500,
              credit_cents: 0,
              journal_entries: { posting_date: '2027-04-10', posting_context: {} }
            },
            {
              account_code: '5351',
              debit_cents: 0,
              credit_cents: 500,
              journal_entries: { posting_date: '2027-04-10', posting_context: {} }
            },
            {
              account_code: '2610',
              debit_cents: 9999,
              credit_cents: 0,
              journal_entries: {
                posting_date: '2027-04-15',
                posting_context: { test_artifact: true }
              }
            },
            {
              account_code: '5351',
              debit_cents: 0,
              credit_cents: 9999,
              journal_entries: {
                posting_date: '2027-04-15',
                posting_context: { test_artifact: true }
              }
            }
          ],
          error: null
        }
      ],
      accounts: [
        {
          data: [
            { code: '2610', name_lv: 'Bank', name_en: 'Bank', type: 'asset' },
            { code: '5351', name_lv: 'Wallet', name_en: 'Wallet', type: 'liability' }
          ],
          error: null
        }
      ]
    });

    const tb = await getTrialBalance(client as never, '2027-04-30', {
      excludeTestArtifacts: false
    });

    expect(tb.total_debit_cents).toBe(10499);
    expect(tb.total_credit_cents).toBe(10499);
    expect(tb.is_balanced).toBe(true);
    expect(tb.rows.find((r) => r.account_code === '2610')?.debit_cents).toBe(10499);
    expect(tb.rows.find((r) => r.account_code === '5351')?.credit_cents).toBe(10499);
  });
});

// =============================================================================
// getAccountLedger
// =============================================================================

describe('getAccountLedger', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('computes running balance for a debit-normal asset account', async () => {
    // Account 2610 (Swedbank, asset). Three lines: prior +500 (opening),
    // in-range +1000 debit, in-range -300 credit. Closing = 500 + 1000 - 300 = 1200.
    const client = buildMockClient({
      accounts: [
        {
          data: {
            code: '2610',
            name_lv: 'Swedbank',
            name_en: 'Swedbank',
            type: 'asset',
            is_vat: false,
            is_active: true,
            parent_code: null,
            created_at: '2026-01-01T00:00:00Z'
          },
          error: null
        }
      ],
      journal_lines: [
        {
          data: [
            {
              id: 'line-pre',
              entry_id: 'entry-pre',
              line_number: 1,
              account_code: '2610',
              debit_cents: 500,
              credit_cents: 0,
              currency: 'EUR',
              fx_rate_snapshot: null,
              vat_rate_snapshot: null,
              vat_country: null,
              counterparty_type: null,
              counterparty_id: null,
              narrative: 'opening',
              journal_entries: {
                id: 'entry-pre',
                posting_date: '2026-12-15',
                accounting_period: '2026-12',
                tax_period: '2026-12',
                entry_type: 'manual',
                type_id: 'H.1',
                source_doc_type: 'historical',
                source_doc_id: 'h-1',
                reverses_entry_id: null,
                correction_reason: null,
                narrative: 'pre-range',
                posting_context: {},
                created_by: 'test',
                created_at: '2026-12-15T00:00:00Z',
                period_close_adjustment: false
              }
            },
            {
              id: 'line-1',
              entry_id: 'entry-1',
              line_number: 1,
              account_code: '2610',
              debit_cents: 1000,
              credit_cents: 0,
              currency: 'EUR',
              fx_rate_snapshot: null,
              vat_rate_snapshot: null,
              vat_country: null,
              counterparty_type: null,
              counterparty_id: null,
              narrative: 'deposit',
              journal_entries: {
                id: 'entry-1',
                posting_date: '2027-01-05',
                accounting_period: '2027-01',
                tax_period: '2027-01',
                entry_type: 'order',
                type_id: 'O.1',
                source_doc_type: 'order',
                source_doc_id: 'order-1',
                reverses_entry_id: null,
                correction_reason: null,
                narrative: 'deposit',
                posting_context: {},
                created_by: 'test',
                created_at: '2027-01-05T00:00:00Z',
                period_close_adjustment: false
              }
            },
            {
              id: 'line-2',
              entry_id: 'entry-2',
              line_number: 1,
              account_code: '2610',
              debit_cents: 0,
              credit_cents: 300,
              currency: 'EUR',
              fx_rate_snapshot: null,
              vat_rate_snapshot: null,
              vat_country: null,
              counterparty_type: null,
              counterparty_id: null,
              narrative: 'payout',
              journal_entries: {
                id: 'entry-2',
                posting_date: '2027-01-15',
                accounting_period: '2027-01',
                tax_period: '2027-01',
                entry_type: 'payout',
                type_id: 'C.4',
                source_doc_type: 'wallet_withdrawal',
                source_doc_id: 'wd-1',
                reverses_entry_id: null,
                correction_reason: null,
                narrative: 'payout',
                posting_context: {},
                created_by: 'test',
                created_at: '2027-01-15T00:00:00Z',
                period_close_adjustment: false
              }
            }
          ],
          error: null
        }
      ]
    });

    const ledger = await getAccountLedger(client as never, '2610', {
      from: '2027-01-01',
      to: '2027-01-31'
    });

    expect(ledger.account.code).toBe('2610');
    expect(ledger.opening_balance_cents).toBe(500);
    expect(ledger.lines).toHaveLength(2);
    // Asset = debit-normal: deposit increments, payout decrements.
    expect(ledger.lines[0]?.running_balance_cents).toBe(1500);
    expect(ledger.lines[1]?.running_balance_cents).toBe(1200);
    expect(ledger.closing_balance_cents).toBe(1200);
  });

  it('computes running balance for a credit-normal liability account', async () => {
    // Account 5351 (wallet liability). Sign convention is uniform — running
    // balance is signed with positive=debit. So a credit-normal liability
    // grows in the negative direction as wallet credit grows. Lines: opening
    // -200 (prior credit), in-range +500 credit (-700 running), -100 debit
    // payout (-600 running). Callers translate sign for display.
    const client = buildMockClient({
      accounts: [
        {
          data: {
            code: '5351',
            name_lv: 'Wallet',
            name_en: 'Wallet liability',
            type: 'liability',
            is_vat: false,
            is_active: true,
            parent_code: '5350',
            created_at: '2026-01-01T00:00:00Z'
          },
          error: null
        }
      ],
      journal_lines: [
        {
          data: [
            // Opening line: credit 200 → net_debit -200.
            {
              id: 'lp',
              entry_id: 'ep',
              line_number: 1,
              account_code: '5351',
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
                id: 'ep',
                posting_date: '2026-12-15',
                accounting_period: '2026-12',
                tax_period: '2026-12',
                entry_type: 'order',
                type_id: 'O.1',
                source_doc_type: 'order',
                source_doc_id: 'pre',
                reverses_entry_id: null,
                correction_reason: null,
                narrative: 'pre',
                posting_context: {},
                created_by: 'test',
                created_at: '2026-12-15T00:00:00Z',
                period_close_adjustment: false
              }
            },
            // In-range: credit 500 → net_debit -500 → running -700.
            {
              id: 'l1',
              entry_id: 'e1',
              line_number: 1,
              account_code: '5351',
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
                id: 'e1',
                posting_date: '2027-01-10',
                accounting_period: '2027-01',
                tax_period: '2027-01',
                entry_type: 'order',
                type_id: 'O.1',
                source_doc_type: 'order',
                source_doc_id: 'in1',
                reverses_entry_id: null,
                correction_reason: null,
                narrative: 'sale',
                posting_context: {},
                created_by: 'test',
                created_at: '2027-01-10T00:00:00Z',
                period_close_adjustment: false
              }
            },
            // In-range: debit 100 → net_debit +100 → running -600.
            {
              id: 'l2',
              entry_id: 'e2',
              line_number: 1,
              account_code: '5351',
              debit_cents: 100,
              credit_cents: 0,
              currency: 'EUR',
              fx_rate_snapshot: null,
              vat_rate_snapshot: null,
              vat_country: null,
              counterparty_type: null,
              counterparty_id: null,
              narrative: null,
              journal_entries: {
                id: 'e2',
                posting_date: '2027-01-20',
                accounting_period: '2027-01',
                tax_period: '2027-01',
                entry_type: 'payout',
                type_id: 'C.4',
                source_doc_type: 'wallet_withdrawal',
                source_doc_id: 'wd1',
                reverses_entry_id: null,
                correction_reason: null,
                narrative: 'wd',
                posting_context: {},
                created_by: 'test',
                created_at: '2027-01-20T00:00:00Z',
                period_close_adjustment: false
              }
            }
          ],
          error: null
        }
      ]
    });

    const ledger = await getAccountLedger(client as never, '5351', {
      from: '2027-01-01',
      to: '2027-01-31'
    });

    expect(ledger.opening_balance_cents).toBe(-200);
    expect(ledger.lines[0]?.running_balance_cents).toBe(-700);
    expect(ledger.lines[1]?.running_balance_cents).toBe(-600);
    expect(ledger.closing_balance_cents).toBe(-600);
  });

  it('throws when account code not found', async () => {
    const client = buildMockClient({
      accounts: [{ data: null, error: null }]
    });
    await expect(
      getAccountLedger(client as never, '9999', { from: '2027-01-01', to: '2027-01-31' })
    ).rejects.toThrow(/account 9999 not found/);
  });
});

// =============================================================================
// getJournalEntry
// =============================================================================

describe('getJournalEntry', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('joins account names onto each line and flags balanced entries', async () => {
    const client = buildMockClient({
      journal_entries: [
        {
          data: {
            id: 'entry-uuid',
            posting_date: '2027-01-15',
            accounting_period: '2027-01',
            tax_period: '2027-01',
            entry_type: 'order',
            type_id: 'O.1',
            source_doc_type: 'order',
            source_doc_id: 'order-x',
            reverses_entry_id: null,
            correction_reason: null,
            narrative: 'O.1 sale',
            posting_context: {},
            created_by: 'posting_engine',
            created_at: '2027-01-15T10:00:00Z',
            period_close_adjustment: false
          },
          error: null
        }
      ],
      journal_lines: [
        {
          data: [
            {
              id: 'l1',
              entry_id: 'entry-uuid',
              line_number: 1,
              account_code: '2610',
              debit_cents: 1000,
              credit_cents: 0,
              currency: 'EUR',
              fx_rate_snapshot: null,
              vat_rate_snapshot: null,
              vat_country: null,
              counterparty_type: null,
              counterparty_id: null,
              narrative: null,
              accounts: { name_lv: 'Swedbank', name_en: 'Swedbank' }
            },
            {
              id: 'l2',
              entry_id: 'entry-uuid',
              line_number: 2,
              account_code: '5351',
              debit_cents: 0,
              credit_cents: 1000,
              currency: 'EUR',
              fx_rate_snapshot: null,
              vat_rate_snapshot: null,
              vat_country: null,
              counterparty_type: 'seller',
              counterparty_id: 'cp-1',
              narrative: null,
              accounts: { name_lv: 'Pārdevēju wallet', name_en: 'Wallet liab' }
            }
          ],
          error: null
        }
      ]
    });

    const detail = await getJournalEntry(client as never, 'entry-uuid');

    expect(detail.entry.id).toBe('entry-uuid');
    expect(detail.lines).toHaveLength(2);
    expect(detail.lines[0]).toMatchObject({
      account_code: '2610',
      account_name_en: 'Swedbank',
      account_name_lv: 'Swedbank'
    });
    expect(detail.lines[1]).toMatchObject({
      account_code: '5351',
      account_name_lv: 'Pārdevēju wallet'
    });
    expect(detail.total_debit_cents).toBe(1000);
    expect(detail.total_credit_cents).toBe(1000);
    expect(detail.is_balanced).toBe(true);
  });

  it('flags imbalanced entries with is_balanced=false', async () => {
    const client = buildMockClient({
      journal_entries: [
        {
          data: {
            id: 'corrupt-entry',
            posting_date: '2027-01-15',
            accounting_period: '2027-01',
            tax_period: '2027-01',
            entry_type: 'manual',
            type_id: 'H.1',
            source_doc_type: 'historical',
            source_doc_id: 'h',
            reverses_entry_id: null,
            correction_reason: null,
            narrative: 'corrupt',
            posting_context: {},
            created_by: 'test',
            created_at: '2027-01-15T10:00:00Z',
            period_close_adjustment: false
          },
          error: null
        }
      ],
      journal_lines: [
        {
          data: [
            {
              id: 'l1',
              entry_id: 'corrupt-entry',
              line_number: 1,
              account_code: '2610',
              debit_cents: 1000,
              credit_cents: 0,
              currency: 'EUR',
              fx_rate_snapshot: null,
              vat_rate_snapshot: null,
              vat_country: null,
              counterparty_type: null,
              counterparty_id: null,
              narrative: null,
              accounts: { name_lv: 'B', name_en: 'B' }
            },
            {
              id: 'l2',
              entry_id: 'corrupt-entry',
              line_number: 2,
              account_code: '5351',
              debit_cents: 0,
              credit_cents: 800,
              currency: 'EUR',
              fx_rate_snapshot: null,
              vat_rate_snapshot: null,
              vat_country: null,
              counterparty_type: null,
              counterparty_id: null,
              narrative: null,
              accounts: { name_lv: 'W', name_en: 'W' }
            }
          ],
          error: null
        }
      ]
    });

    const detail = await getJournalEntry(client as never, 'corrupt-entry');
    expect(detail.is_balanced).toBe(false);
    expect(detail.total_debit_cents).toBe(1000);
    expect(detail.total_credit_cents).toBe(800);
  });

  it('throws when entry id not found', async () => {
    const client = buildMockClient({
      journal_entries: [{ data: null, error: null }]
    });
    await expect(getJournalEntry(client as never, 'missing-uuid')).rejects.toThrow(
      /entry missing-uuid not found/
    );
  });
});

// =============================================================================
// getWalletIntegrity
// =============================================================================

describe('getWalletIntegrity', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns delta=0 and empty per-seller deltas when GL and wallets table are both empty (Phase 0)', async () => {
    const client = buildMockClient({
      journal_lines: [{ data: [], error: null }],
      wallets: [{ data: [], error: null }]
      // No counterparties / public_profiles queries: per-user-id loop has nothing to resolve.
    });

    const result = await getWalletIntegrity(client as never);

    expect(result.gl_5351_sum_cents).toBe(0);
    expect(result.wallet_table_sum_cents).toBe(0);
    expect(result.delta_cents).toBe(0);
    expect(result.is_reconciled).toBe(true);
    expect(result.per_seller_deltas).toEqual([]);
  });

  it('reconciles when GL 5351 matches wallets table', async () => {
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            // Counterparty cp-A: credit 1000 (seller earned 10€).
            { debit_cents: 0, credit_cents: 1000, counterparty_id: 'cp-A' },
            // Counterparty cp-B: credit 500 (seller earned 5€).
            { debit_cents: 0, credit_cents: 500, counterparty_id: 'cp-B' }
          ],
          error: null
        }
      ],
      wallets: [
        {
          data: [
            { user_id: 'user-A', balance_cents: 1000 },
            { user_id: 'user-B', balance_cents: 500 }
          ],
          error: null
        }
      ],
      counterparties: [
        {
          data: [
            { id: 'cp-A', user_id: 'user-A' },
            { id: 'cp-B', user_id: 'user-B' }
          ],
          error: null
        }
      ]
      // No public_profiles query: per_seller_deltas is empty so no handle resolution.
    });

    const result = await getWalletIntegrity(client as never);
    expect(result.gl_5351_sum_cents).toBe(1500);
    expect(result.wallet_table_sum_cents).toBe(1500);
    expect(result.delta_cents).toBe(0);
    expect(result.is_reconciled).toBe(true);
    expect(result.per_seller_deltas).toEqual([]);
  });

  it('surfaces per-seller deltas with handles when GL and wallet diverge', async () => {
    // cp-A: GL says 1000 credit (10€ liability), wallet table says 800 → delta +200.
    // cp-B: GL says 500 credit, wallet table says 500 → reconciled (excluded).
    // user-C: wallet table says 100 with no GL counterparty → delta -100.
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            { debit_cents: 0, credit_cents: 1000, counterparty_id: 'cp-A' },
            { debit_cents: 0, credit_cents: 500, counterparty_id: 'cp-B' }
          ],
          error: null
        }
      ],
      wallets: [
        {
          data: [
            { user_id: 'user-A', balance_cents: 800 },
            { user_id: 'user-B', balance_cents: 500 },
            { user_id: 'user-C', balance_cents: 100 }
          ],
          error: null
        }
      ],
      counterparties: [
        {
          data: [
            { id: 'cp-A', user_id: 'user-A' },
            { id: 'cp-B', user_id: 'user-B' }
          ],
          error: null
        }
      ],
      public_profiles: [
        {
          data: [
            { id: 'user-A', full_name: 'Alice' },
            { id: 'user-C', full_name: null }
          ],
          error: null
        }
      ]
    });

    const result = await getWalletIntegrity(client as never);

    expect(result.gl_5351_sum_cents).toBe(1500);
    expect(result.wallet_table_sum_cents).toBe(1400);
    expect(result.delta_cents).toBe(100);
    expect(result.is_reconciled).toBe(false);
    expect(result.per_seller_deltas).toHaveLength(2);

    // Sorted by abs(delta) desc — A's +200 first.
    expect(result.per_seller_deltas[0]).toMatchObject({
      seller_user_id: 'user-A',
      seller_handle: 'Alice',
      gl_balance_cents: 1000,
      wallet_balance_cents: 800,
      delta_cents: 200
    });
    expect(result.per_seller_deltas[1]).toMatchObject({
      seller_user_id: 'user-C',
      seller_handle: null,
      gl_balance_cents: 0,
      wallet_balance_cents: 100,
      delta_cents: -100
    });
    // No counterparties were unresolvable in this fixture.
    expect(result.unattributed_gl_cents).toBe(0);
  });

  it('routes unattributable GL lines into unattributed_gl_cents instead of dropping them', async () => {
    // GL has three 5351 lines:
    //   - cp-A (resolvable to user-A): credit 1000 → matches wallet, no per-seller delta.
    //   - cp-SYS (system counterparty, user_id=null): credit 300 → unattributable.
    //   - no counterparty_id at all: credit 50 → unattributable.
    // Wallet table: user-A has 1000.
    // Expected: gl_5351_sum_cents=1350, wallet_table_sum_cents=1000,
    // delta_cents=350, unattributed_gl_cents=350, per_seller_deltas=[].
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            { debit_cents: 0, credit_cents: 1000, counterparty_id: 'cp-A' },
            { debit_cents: 0, credit_cents: 300, counterparty_id: 'cp-SYS' },
            { debit_cents: 0, credit_cents: 50, counterparty_id: null }
          ],
          error: null
        }
      ],
      wallets: [
        {
          data: [{ user_id: 'user-A', balance_cents: 1000 }],
          error: null
        }
      ],
      counterparties: [
        {
          data: [
            { id: 'cp-A', user_id: 'user-A' },
            // cp-SYS is a system counterparty (e.g. STG_INTERNAL): present
            // in counterparties but user_id IS NULL. Must not be silently
            // dropped from the global delta narrative.
            { id: 'cp-SYS', user_id: null }
          ],
          error: null
        }
      ]
      // No public_profiles query expected — per_seller_deltas is empty.
    });

    const result = await getWalletIntegrity(client as never);

    expect(result.gl_5351_sum_cents).toBe(1350);
    expect(result.wallet_table_sum_cents).toBe(1000);
    expect(result.delta_cents).toBe(350);
    expect(result.is_reconciled).toBe(false);
    expect(result.unattributed_gl_cents).toBe(350);
    // Critically: the unattributable lines do NOT appear in per_seller_deltas,
    // and user-A reconciles cleanly so it doesn't appear either.
    expect(result.per_seller_deltas).toEqual([]);
  });

  // ===========================================================================
  // PR C commit 11b — Shape-2 lazy timing for withdrawals
  // ===========================================================================
  //
  // wallet_table is debited at request time (wallet_withdrawal_debit,
  // migration 071); GL 5351 is debited at completion time (commit 10 C.4).
  // Between request and completion, gl_5351 leads wallet_table by the
  // in-flight withdrawal amount. The reconciled invariant becomes
  // `delta_cents === in_flight_withdrawals_cents`, NOT `delta === 0`.

  describe('in-flight withdrawals (Shape 2)', () => {
    it('returns in_flight_withdrawals_cents=0 + empty stale list when no approved withdrawals exist', async () => {
      const client = buildMockClient({
        journal_lines: [{ data: [], error: null }],
        wallets: [{ data: [], error: null }],
        withdrawal_requests: [{ data: [], error: null }],
      });
      const result = await getWalletIntegrity(client as never);
      expect(result.in_flight_withdrawals_cents).toBe(0);
      expect(result.stale_in_flight_withdrawals).toEqual([]);
      expect(result.is_reconciled).toBe(true); // delta=0 matches in_flight=0
    });

    it('reconciles when delta_cents matches in_flight_withdrawals_cents (new contract)', async () => {
      // Pre-cutover wallet credit of €100 to user-A (Cr 5351 100€).
      // Then withdrawal request of €30 — wallet table debits to 70€,
      // GL 5351 still credit 100€ (no C.4 fired yet). delta = +30€.
      // Reconciled invariant: delta === in_flight === 30€.
      const client = buildMockClient({
        journal_lines: [
          {
            data: [{ debit_cents: 0, credit_cents: 10000, counterparty_id: 'cp-A' }],
            error: null,
          },
        ],
        wallets: [
          { data: [{ user_id: 'user-A', balance_cents: 7000 }], error: null },
        ],
        counterparties: [
          { data: [{ id: 'cp-A', user_id: 'user-A' }], error: null },
        ],
        public_profiles: [
          { data: [{ id: 'user-A', full_name: 'Test Seller' }], error: null },
        ],
        withdrawal_requests: [
          {
            data: [
              {
                id: 'wd-1',
                user_id: 'user-A',
                amount_cents: 3000,
                reviewed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
              },
            ],
            error: null,
          },
        ],
      });
      const result = await getWalletIntegrity(client as never);
      expect(result.gl_5351_sum_cents).toBe(10000);
      expect(result.wallet_table_sum_cents).toBe(7000);
      expect(result.delta_cents).toBe(3000);
      expect(result.in_flight_withdrawals_cents).toBe(3000);
      expect(result.is_reconciled).toBe(true);
      // user-A's delta != 0 so it surfaces in per_seller_deltas — that's the
      // expected legacy per-seller view; the reconciliation banner uses
      // is_reconciled (which is now true with the Shape-2 contract).
      expect(result.per_seller_deltas).toHaveLength(1);
      expect(result.per_seller_deltas[0]!.delta_cents).toBe(3000);
    });

    it('flags is_reconciled=false when delta does NOT equal in_flight (true discrepancy)', async () => {
      // GL credit 100€, wallet balance 60€, in-flight 30€ — but delta is 40€,
      // not 30€. 10€ discrepancy beyond the in-flight expectation.
      const client = buildMockClient({
        journal_lines: [
          {
            data: [{ debit_cents: 0, credit_cents: 10000, counterparty_id: 'cp-A' }],
            error: null,
          },
        ],
        wallets: [{ data: [{ user_id: 'user-A', balance_cents: 6000 }], error: null }],
        counterparties: [{ data: [{ id: 'cp-A', user_id: 'user-A' }], error: null }],
        public_profiles: [{ data: [{ id: 'user-A', full_name: 'Test' }], error: null }],
        withdrawal_requests: [
          {
            data: [
              {
                id: 'wd-1',
                user_id: 'user-A',
                amount_cents: 3000,
                reviewed_at: new Date().toISOString(),
              },
            ],
            error: null,
          },
        ],
      });
      const result = await getWalletIntegrity(client as never);
      expect(result.delta_cents).toBe(4000);
      expect(result.in_flight_withdrawals_cents).toBe(3000);
      expect(result.is_reconciled).toBe(false);
    });

    it('detects stale in-flight withdrawals beyond STALE_IN_FLIGHT_DAYS threshold (7d)', async () => {
      const stale = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days
      const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days
      const client = buildMockClient({
        journal_lines: [{ data: [], error: null }],
        wallets: [{ data: [], error: null }],
        withdrawal_requests: [
          {
            data: [
              { id: 'wd-stale', user_id: 'user-X', amount_cents: 5000, reviewed_at: stale },
              { id: 'wd-recent', user_id: 'user-Y', amount_cents: 3000, reviewed_at: recent },
            ],
            error: null,
          },
        ],
      });
      const result = await getWalletIntegrity(client as never);
      expect(result.in_flight_withdrawals_cents).toBe(8000);
      expect(result.stale_in_flight_withdrawals).toHaveLength(1);
      expect(result.stale_in_flight_withdrawals[0]!.withdrawal_request_id).toBe('wd-stale');
      expect(result.stale_in_flight_withdrawals[0]!.days_in_flight).toBeGreaterThanOrEqual(7);
    });

    it('sums multiple in-flight withdrawals across users correctly', async () => {
      const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const client = buildMockClient({
        journal_lines: [{ data: [], error: null }],
        wallets: [{ data: [], error: null }],
        withdrawal_requests: [
          {
            data: [
              { id: 'wd-1', user_id: 'user-A', amount_cents: 1000, reviewed_at: recent },
              { id: 'wd-2', user_id: 'user-B', amount_cents: 2500, reviewed_at: recent },
              { id: 'wd-3', user_id: 'user-C', amount_cents: 750, reviewed_at: recent },
            ],
            error: null,
          },
        ],
      });
      const result = await getWalletIntegrity(client as never);
      expect(result.in_flight_withdrawals_cents).toBe(4250);
      expect(result.stale_in_flight_withdrawals).toEqual([]);
    });
  });
});

// =============================================================================
// getWalletIntegrityAsOf
// =============================================================================
//
// Period-scoped variant. Mirrors getWalletIntegrity's tests with the asOf
// boundary added: `journal_entries!inner(posting_date)` join + lte filter on
// the GL side, and `wallet_transactions` ordered DESC by created_at on the
// wallet side (taking the first row per user_id as their period-bounded
// balance_after_cents).

describe('getWalletIntegrityAsOf', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns delta=0 and empty deltas when no GL 5351 lines and no wallet_transactions ≤ asOf (Phase 0 case)', async () => {
    const client = buildMockClient({
      journal_lines: [{ data: [], error: null }],
      wallet_transactions: [{ data: [], error: null }]
    });

    const result = await getWalletIntegrityAsOf(client as never, '2026-03-31');

    expect(result.as_of).toBe('2026-03-31');
    expect(result.gl_5351_sum_cents).toBe(0);
    expect(result.wallet_table_sum_cents).toBe(0);
    expect(result.delta_cents).toBe(0);
    expect(result.is_reconciled).toBe(true);
    expect(result.unattributed_gl_cents).toBe(0);
    expect(result.per_seller_deltas).toEqual([]);
  });

  it('reconciles for a single seller balanced as of asOf', async () => {
    // user-A: GL credit 1000 ≤ asOf via cp-A; wallet_tx balance_after_cents=1000
    // ≤ asOf. delta=0.
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            {
              debit_cents: 0,
              credit_cents: 1000,
              counterparty_id: 'cp-A',
              journal_entries: { posting_date: '2026-04-15' }
            }
          ],
          error: null
        }
      ],
      wallet_transactions: [
        {
          data: [
            {
              user_id: 'user-A',
              balance_after_cents: 1000,
              created_at: '2026-04-15T10:00:00Z'
            }
          ],
          error: null
        }
      ],
      counterparties: [
        { data: [{ id: 'cp-A', user_id: 'user-A' }], error: null }
      ]
    });

    const result = await getWalletIntegrityAsOf(client as never, '2026-04-30');
    expect(result.gl_5351_sum_cents).toBe(1000);
    expect(result.wallet_table_sum_cents).toBe(1000);
    expect(result.delta_cents).toBe(0);
    expect(result.is_reconciled).toBe(true);
    expect(result.per_seller_deltas).toEqual([]);
  });

  it('surfaces per-seller deltas when one user diverges and another reconciles', async () => {
    // user-A: GL 1000 + wallet 1000 → balanced (excluded from per_seller_deltas).
    // user-B: GL 500, no wallet row → +500 delta.
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            {
              debit_cents: 0,
              credit_cents: 1000,
              counterparty_id: 'cp-A',
              journal_entries: { posting_date: '2026-04-10' }
            },
            {
              debit_cents: 0,
              credit_cents: 500,
              counterparty_id: 'cp-B',
              journal_entries: { posting_date: '2026-04-12' }
            }
          ],
          error: null
        }
      ],
      wallet_transactions: [
        {
          data: [
            {
              user_id: 'user-A',
              balance_after_cents: 1000,
              created_at: '2026-04-10T10:00:00Z'
            }
          ],
          error: null
        }
      ],
      counterparties: [
        {
          data: [
            { id: 'cp-A', user_id: 'user-A' },
            { id: 'cp-B', user_id: 'user-B' }
          ],
          error: null
        }
      ],
      public_profiles: [
        { data: [{ id: 'user-B', full_name: 'Bob' }], error: null }
      ]
    });

    const result = await getWalletIntegrityAsOf(client as never, '2026-04-30');
    expect(result.gl_5351_sum_cents).toBe(1500);
    expect(result.wallet_table_sum_cents).toBe(1000);
    expect(result.delta_cents).toBe(500);
    expect(result.is_reconciled).toBe(false);
    expect(result.per_seller_deltas).toHaveLength(1);
    expect(result.per_seller_deltas[0]).toMatchObject({
      seller_user_id: 'user-B',
      seller_handle: 'Bob',
      gl_balance_cents: 500,
      wallet_balance_cents: 0,
      delta_cents: 500
    });
  });

  it('respects the asOf boundary on wallet_transactions: the function relies on the .lte() filter to exclude post-asOf rows', async () => {
    // The mock builder's chain is loose — .lte() is mocked to return the
    // builder, so date filtering happens server-side in production. Here we
    // simulate by feeding only the rows we expect the server to return for
    // ≤ asOf and asserting the function takes the first (most recent ≤ asOf)
    // balance_after_cents per user_id.
    //
    // Scenario: user-A had balance 500 on 2026-03-15 (≤ asOf=2026-03-31).
    // A later transaction on 2026-04-20 brought the balance to 1000 — that
    // row is filtered out by the server-side .lte() before reaching us.
    // Function must use 500, not 1000.
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            {
              debit_cents: 0,
              credit_cents: 500,
              counterparty_id: 'cp-A',
              journal_entries: { posting_date: '2026-03-15' }
            }
          ],
          error: null
        }
      ],
      wallet_transactions: [
        {
          // Server returned only the row dated ≤ asOf (DESC by created_at).
          // The post-asOf 2026-04-20 row was excluded by the .lte() filter.
          data: [
            {
              user_id: 'user-A',
              balance_after_cents: 500,
              created_at: '2026-03-15T10:00:00Z'
            }
          ],
          error: null
        }
      ],
      counterparties: [
        { data: [{ id: 'cp-A', user_id: 'user-A' }], error: null }
      ]
    });

    const result = await getWalletIntegrityAsOf(client as never, '2026-03-31');
    expect(result.wallet_table_sum_cents).toBe(500);
    expect(result.delta_cents).toBe(0);
    expect(result.is_reconciled).toBe(true);
  });

  it('routes 5351 GL lines with null counterparty_id into unattributed_gl_cents (period-scoped)', async () => {
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            // Resolvable line: cp-A → user-A, balanced against wallet.
            {
              debit_cents: 0,
              credit_cents: 1000,
              counterparty_id: 'cp-A',
              journal_entries: { posting_date: '2026-04-10' }
            },
            // Null counterparty_id: must flow into unattributed_gl_cents.
            {
              debit_cents: 0,
              credit_cents: 50,
              counterparty_id: null,
              journal_entries: { posting_date: '2026-04-12' }
            }
          ],
          error: null
        }
      ],
      wallet_transactions: [
        {
          data: [
            {
              user_id: 'user-A',
              balance_after_cents: 1000,
              created_at: '2026-04-10T10:00:00Z'
            }
          ],
          error: null
        }
      ],
      counterparties: [
        { data: [{ id: 'cp-A', user_id: 'user-A' }], error: null }
      ]
    });

    const result = await getWalletIntegrityAsOf(client as never, '2026-04-30');
    expect(result.gl_5351_sum_cents).toBe(1050);
    expect(result.wallet_table_sum_cents).toBe(1000);
    expect(result.delta_cents).toBe(50);
    expect(result.is_reconciled).toBe(false);
    expect(result.unattributed_gl_cents).toBe(50);
    // user-A reconciles cleanly so no per-seller delta entry.
    expect(result.per_seller_deltas).toEqual([]);
  });

  it('takes the LATEST balance_after_cents per user when multiple wallet_transactions ≤ asOf exist', async () => {
    // Same user has two wallet_transactions ≤ asOf; the function must take
    // the most recent. The server orders DESC by created_at — the mock feeds
    // rows in that order so the first row per user_id is the latest.
    //
    // user-A: tx1 on 2026-03-10 (balance 200), tx2 on 2026-03-20 (balance 800).
    // GL credit 800 → reconciled at asOf=2026-03-31 only if we use 800, not 200.
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            {
              debit_cents: 0,
              credit_cents: 800,
              counterparty_id: 'cp-A',
              journal_entries: { posting_date: '2026-03-20' }
            }
          ],
          error: null
        }
      ],
      wallet_transactions: [
        {
          // DESC by created_at: latest first. Function must pick this one.
          data: [
            {
              user_id: 'user-A',
              balance_after_cents: 800,
              created_at: '2026-03-20T10:00:00Z'
            },
            {
              user_id: 'user-A',
              balance_after_cents: 200,
              created_at: '2026-03-10T10:00:00Z'
            }
          ],
          error: null
        }
      ],
      counterparties: [
        { data: [{ id: 'cp-A', user_id: 'user-A' }], error: null }
      ]
    });

    const result = await getWalletIntegrityAsOf(client as never, '2026-03-31');
    expect(result.wallet_table_sum_cents).toBe(800);
    expect(result.delta_cents).toBe(0);
    expect(result.is_reconciled).toBe(true);
  });
});

// =============================================================================
// getPeriodRow
// =============================================================================

describe('getPeriodRow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the period row when found', async () => {
    const client = buildMockClient({
      periods: [
        {
          data: {
            period_key: '2027-01',
            period_type: 'month',
            status: 'open',
            locked_at: null,
            locked_by: null,
            created_at: '2026-01-01T00:00:00Z'
          },
          error: null
        }
      ]
    });
    const row = await getPeriodRow(client as never, '2027-01', 'month');
    expect(row?.period_key).toBe('2027-01');
    expect(row?.status).toBe('open');
  });

  it('returns null when not seeded', async () => {
    const client = buildMockClient({
      periods: [{ data: null, error: null }]
    });
    const row = await getPeriodRow(client as never, '2099-12', 'month');
    expect(row).toBeNull();
  });
});

// =============================================================================
// getEntriesPostedSince
// =============================================================================

describe('getEntriesPostedSince', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns entries posted to the period since the cutoff', async () => {
    const entries = [
      { id: 'e1', accounting_period: '2027-01', created_at: '2027-02-05T08:00:00Z' },
      { id: 'e2', accounting_period: '2027-01', created_at: '2027-02-05T09:00:00Z' }
    ];
    const client = buildMockClient({
      journal_entries: [{ data: entries, error: null }]
    });
    const result = await getEntriesPostedSince(
      client as never,
      '2027-01',
      '2027-02-01T00:00:00Z'
    );
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe('e1');
  });
});

// =============================================================================
// getRecentJournalEntries
// =============================================================================

describe('getRecentJournalEntries', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('orders by created_at DESC and respects limit (DB-side)', async () => {
    // The function delegates ordering + limit to PostgREST. Verify it
    // requests the right shape (order on created_at desc + limit) and
    // returns whatever the DB returned in that order. The function
    // over-fetches a buffer to absorb test_artifact filtering, so when
    // excludeTestArtifacts=false the limit passes through 1:1; when true
    // (default), the SELECT limit is `limit*2 + 10` and the trim happens
    // in memory.
    const queue = [
      {
        data: [
          { id: 'newer', created_at: '2027-03-01T00:00:00Z', accounting_period: '2027-03' },
          { id: 'older', created_at: '2027-02-01T00:00:00Z', accounting_period: '2027-02' }
        ],
        error: null
      }
    ];
    const fromMock = vi.fn(() => {
      const builder: Record<string, ReturnType<typeof vi.fn>> & {
        then?: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => Promise<unknown>;
      } = {
        select: vi.fn(),
        order: vi.fn(),
        limit: vi.fn()
      };
      builder.select.mockReturnValue(builder);
      builder.order.mockReturnValue(builder);
      builder.limit.mockReturnValue(builder);
      builder.then = (onFulfilled, onRejected) =>
        Promise.resolve(queue.shift() ?? { data: [], error: null }).then(
          onFulfilled,
          onRejected
        );
      return builder;
    });
    const client = { from: fromMock, rpc: vi.fn() };

    // Pass excludeTestArtifacts=false so the SELECT limit matches the
    // requested 5 exactly (no buffered over-fetch).
    const rows = await getRecentJournalEntries(client as never, 5, {
      excludeTestArtifacts: false
    });

    expect(fromMock).toHaveBeenCalledWith('journal_entries');
    const builder = fromMock.mock.results[0]?.value as {
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    };
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(5);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe('newer');
    expect(rows[1]?.id).toBe('older');
  });

  it('filters posting_context.test_artifact rows by default and trims to limit', async () => {
    // Mixed feed: 3 real rows interspersed with 2 test_artifact rows. With
    // limit=2 and excludeTestArtifacts default-true, the function must
    // return the first 2 non-test rows in DB order.
    const queue = [
      {
        data: [
          {
            id: 'real-1',
            created_at: '2027-04-20T00:00:00Z',
            accounting_period: '2027-04',
            posting_context: {}
          },
          {
            id: 'test-1',
            created_at: '2027-04-19T00:00:00Z',
            accounting_period: '2027-01',
            posting_context: { test_artifact: true }
          },
          {
            id: 'real-2',
            created_at: '2027-04-18T00:00:00Z',
            accounting_period: '2027-04',
            posting_context: {}
          },
          {
            id: 'test-2',
            created_at: '2027-04-17T00:00:00Z',
            accounting_period: '2027-01',
            posting_context: { test_artifact: true }
          },
          {
            id: 'real-3',
            created_at: '2027-04-16T00:00:00Z',
            accounting_period: '2027-04',
            posting_context: {}
          }
        ],
        error: null
      }
    ];
    const fromMock = vi.fn(() => {
      const builder: Record<string, ReturnType<typeof vi.fn>> & {
        then?: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => Promise<unknown>;
      } = {
        select: vi.fn(),
        order: vi.fn(),
        limit: vi.fn()
      };
      builder.select.mockReturnValue(builder);
      builder.order.mockReturnValue(builder);
      builder.limit.mockReturnValue(builder);
      builder.then = (onFulfilled, onRejected) =>
        Promise.resolve(queue.shift() ?? { data: [], error: null }).then(
          onFulfilled,
          onRejected
        );
      return builder;
    });
    const client = { from: fromMock, rpc: vi.fn() };

    const rows = await getRecentJournalEntries(client as never, 2);

    // Buffered SELECT: limit*2 + 10 = 14. Filter happens in memory.
    const builder = fromMock.mock.results[0]?.value as {
      limit: ReturnType<typeof vi.fn>;
    };
    expect(builder.limit).toHaveBeenCalledWith(14);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe('real-1');
    expect(rows[1]?.id).toBe('real-2');
  });
});

// =============================================================================
// getNetVatPositionForPeriod (PR C commit 12)
// =============================================================================
//
// Reads cumulative 5710-LV-IN + 5710-LV-OUT movement for a period and produces
// the P.1 closing-entry shape (refund / payable / zero-net). RC sub-accounts
// excluded by design — Q12-4 sign-off. Tests assert each shape:
//
//   has_no_movement → cron skips emit; lines empty
//   refund (lv_in > lv_out) → 3 lines incl Dr 2380
//   payable (lv_out > lv_in) → 3 lines incl Cr 5710-09
//   zero-net (both nonzero, equal) → 2 lines, no third leg
//   RC-only movement → has_no_movement=true (RC excluded by filter)

describe('getNetVatPositionForPeriod', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns has_no_movement=true when no 5710-LV-* movement at all', async () => {
    const client = buildMockClient({
      journal_lines: [{ data: [], error: null }]
    });
    const result = await getNetVatPositionForPeriod(client as never, {
      period_key: '2026-08',
      posting_date: '2026-08-31'
    });
    expect(result.has_no_movement).toBe(true);
    expect(result.lv_in_cents).toBe(0);
    expect(result.lv_out_cents).toBe(0);
    expect(result.net_payable_to_vid_cents).toBe(0);
    expect(result.lines).toEqual([]);
  });

  it('emits refund-position shape (Dr 5710-LV-OUT + Cr 5710-LV-IN + Dr 2380) — April pattern', async () => {
    // Mirrors close_2026_04: lv_out collected 38 (Cr-normal +38),
    // lv_in paid 68 (debit-normal; net Cr-Dr = -68). Refund of 30.
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            // LV-OUT: 38 credit, 0 debit → net_credit = +38
            { account_code: '5710-LV-OUT', debit_cents: 0, credit_cents: 38 },
            // LV-IN: 0 credit, 68 debit → net_credit = -68 → abs = 68
            { account_code: '5710-LV-IN', debit_cents: 68, credit_cents: 0 }
          ],
          error: null
        }
      ]
    });

    const result = await getNetVatPositionForPeriod(client as never, {
      period_key: '2026-04',
      posting_date: '2026-04-30'
    });

    expect(result.has_no_movement).toBe(false);
    expect(result.lv_in_cents).toBe(68);
    expect(result.lv_out_cents).toBe(38);
    // signed_net_payable = lv_out - abs(lv_in) = 38 - 68 = -30 (refund)
    expect(result.net_payable_to_vid_cents).toBe(-30);

    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toMatchObject({ account_code: '5710-LV-OUT', debit_cents: 38, credit_cents: 0 });
    expect(result.lines[1]).toMatchObject({ account_code: '5710-LV-IN', debit_cents: 0, credit_cents: 68 });
    expect(result.lines[2]).toMatchObject({ account_code: '2380', debit_cents: 30, credit_cents: 0 });

    const sumDr = result.lines.reduce((s, l) => s + l.debit_cents, 0);
    const sumCr = result.lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(sumDr).toBe(sumCr);
  });

  it('emits payable-position shape (Dr 5710-LV-OUT + Cr 5710-LV-IN + Cr 5710-09)', async () => {
    // High-volume month: lv_out 15000, lv_in 2000. Net payable 13000.
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            { account_code: '5710-LV-OUT', debit_cents: 0, credit_cents: 15000 },
            { account_code: '5710-LV-IN', debit_cents: 2000, credit_cents: 0 }
          ],
          error: null
        }
      ]
    });

    const result = await getNetVatPositionForPeriod(client as never, {
      period_key: '2026-07',
      posting_date: '2026-07-31'
    });

    expect(result.lv_in_cents).toBe(2000);
    expect(result.lv_out_cents).toBe(15000);
    // signed_net_payable = 15000 - 2000 = +13000 (payable)
    expect(result.net_payable_to_vid_cents).toBe(13000);

    expect(result.lines).toHaveLength(3);
    expect(result.lines[2]).toMatchObject({
      account_code: '5710-09',
      debit_cents: 0,
      credit_cents: 13000
    });

    const sumDr = result.lines.reduce((s, l) => s + l.debit_cents, 0);
    const sumCr = result.lines.reduce((s, l) => s + l.credit_cents, 0);
    expect(sumDr).toBe(sumCr);
  });

  it('emits 2-line zero-net shape when both LV-IN and LV-OUT are nonzero but equal (Q12-5)', async () => {
    // Hypothetical period: lv_out 500 Cr-normal, lv_in 500 Dr-normal (equal magnitudes).
    // Distinct from "no movement" (both zero) — period had real activity that
    // happens to net out. P.1 fires to clear both sub-accounts; no third leg.
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            { account_code: '5710-LV-OUT', debit_cents: 0, credit_cents: 500 },
            { account_code: '5710-LV-IN', debit_cents: 500, credit_cents: 0 }
          ],
          error: null
        }
      ]
    });

    const result = await getNetVatPositionForPeriod(client as never, {
      period_key: '2026-09',
      posting_date: '2026-09-30'
    });

    expect(result.has_no_movement).toBe(false);
    expect(result.net_payable_to_vid_cents).toBe(0);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({ account_code: '5710-LV-OUT', debit_cents: 500 });
    expect(result.lines[1]).toMatchObject({ account_code: '5710-LV-IN', credit_cents: 500 });
  });

  it('excludes RC sub-accounts from the SELECT (Q12-4 sign-off)', async () => {
    // Period had only RC movement (no LV-IN/LV-OUT). The .in() filter on
    // ['5710-LV-IN', '5710-LV-OUT'] excludes RC accounts at SELECT time,
    // so the mock returns []. has_no_movement=true even though the period
    // had real RC activity — that's the intended behavior per April Fix 3
    // (foreign RC stays on balance sheet; domestic RC washes within period).
    const client = buildMockClient({
      journal_lines: [{ data: [], error: null }]
    });

    const result = await getNetVatPositionForPeriod(client as never, {
      period_key: '2026-10',
      posting_date: '2026-10-31'
    });

    expect(result.has_no_movement).toBe(true);
    expect(result.lines).toEqual([]);
  });

  it('handles only-LV-OUT movement (input VAT zero, output VAT positive — pure-payable)', async () => {
    const client = buildMockClient({
      journal_lines: [
        {
          data: [
            { account_code: '5710-LV-OUT', debit_cents: 0, credit_cents: 2100 }
          ],
          error: null
        }
      ]
    });

    const result = await getNetVatPositionForPeriod(client as never, {
      period_key: '2026-11',
      posting_date: '2026-11-30'
    });

    expect(result.lv_in_cents).toBe(0);
    expect(result.lv_out_cents).toBe(2100);
    expect(result.net_payable_to_vid_cents).toBe(2100);

    // Lines: Dr 5710-LV-OUT 2100 + Cr 5710-LV-IN 0 + Cr 5710-09 2100.
    // But Cr 5710-LV-IN 0 would violate journal_lines CHECK (no zero-amount
    // lines)? Actually buildPreComputedLines DOESN'T filter zero-amount lines
    // — they pass through. The engine's assertBalanced just checks the sum.
    // For this edge case the 0-amount LV-IN line is a no-op but balanced.
    // Real-world: LV-IN=0 means no vendor invoices in the period — rare but
    // possible for early platform months. The P.1 still fires to mark the
    // period closed; staff sees the trivial entry.
    expect(result.lines).toHaveLength(3);
    expect(result.lines[1]).toMatchObject({ account_code: '5710-LV-IN', credit_cents: 0 });
  });
});

// =============================================================================
// getInFlightCartReceiptsTotal — backfill source_doc_id convention
//
// Regression: backfill cart/order entries use label source_doc_ids (e.g.
// 'may_2026_entry_6'), not the live convention source_doc_id = cart_group_id /
// order_id. The canonical id lives in posting_context.cart_payment_id (Step 1)
// and posting_context.order_id (Step 3). Reading source_doc_id fed a non-UUID
// label into the orders.cart_group_id (uuid) filter → "invalid input syntax for
// type uuid: april_2026_entry_3" when the period-close checklist loaded.
// =============================================================================

describe('getInFlightCartReceiptsTotal — backfill posting_context keys', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const CART_A = 'aaaaaaaa-0000-4000-8000-000000000001';
  const CART_B = 'bbbbbbbb-0000-4000-8000-000000000002';
  const ORDER_A = 'cccccccc-0000-4000-8000-000000000003';
  const ORDER_B = 'dddddddd-0000-4000-8000-000000000004';

  it('reads cart_group_id + order_id from posting_context for backfill entries (label source_doc_ids)', async () => {
    const client = buildMockClient({
      journal_entries: [
        // Step 1 — cart receipts: backfill label source_doc_id, UUID in posting_context.cart_payment_id
        {
          data: [
            { posting_context: { cart_payment_id: CART_A } },
            { posting_context: { cart_payment_id: CART_B } }
          ],
          error: null
        },
        // Step 3 — releases: backfill O.1 with label source_doc_id, UUID in posting_context.order_id
        {
          data: [
            { source_doc_id: 'may_2026_entry_7', type_id: 'O.1', posting_context: { order_id: ORDER_A } }
          ],
          error: null
        }
      ],
      orders: [
        {
          data: [
            { id: ORDER_A, items_total_cents: 2000, shipping_cost_cents: 190, cart_group_id: CART_A }, // released
            { id: ORDER_B, items_total_cents: 7000, shipping_cost_cents: 350, cart_group_id: CART_B }  // in-flight
          ],
          error: null
        }
      ]
    });

    const total = await getInFlightCartReceiptsTotal(client as never, '2026-05-31');
    // Order A is released by the backfill O.1 (matched via posting_context.order_id),
    // so only Order B's €73.50 remains in-flight suspense.
    expect(total).toBe(7350);
  });

  it('returns 0 without an orders query when no cart receipt carries a cart_payment_id', async () => {
    const client = buildMockClient({
      journal_entries: [{ data: [{ posting_context: {} }], error: null }],
      orders: []
    });
    const total = await getInFlightCartReceiptsTotal(client as never, '2026-05-31');
    expect(total).toBe(0);
  });
});

// =============================================================================
// getInTransitEverypayClearingTotal — period-close item 7 (2630) gate
// =============================================================================

describe('getInTransitEverypayClearingTotal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const REF_SETTLED = 'everypay-ref-settled-aaaa';
  const REF_INTRANSIT_1 = 'everypay-ref-intransit-bbbb';
  const REF_INTRANSIT_2 = 'everypay-ref-intransit-cccc';

  it('sums card receipts whose EveryPay ref has not been settled; excludes settled refs', async () => {
    const client = buildMockClient({
      journal_entries: [
        // Step 1 — card receipts (C.1)
        {
          data: [
            { posting_context: { everypay_payment_id: REF_SETTLED, everypay_charge_cents: 7350 } },
            { posting_context: { everypay_payment_id: REF_INTRANSIT_1, everypay_charge_cents: 2834 } },
            { posting_context: { everypay_payment_id: REF_INTRANSIT_2, everypay_charge_cents: 12210 } }
          ],
          error: null
        },
        // Step 2 — settlements (C.3): REF_SETTLED released from 2630
        { data: [{ posting_context: { included_txn_refs: [REF_SETTLED] } }], error: null },
        // Step 3 — card refunds (C.9): none
        { data: [], error: null }
      ]
    });
    const total = await getInTransitEverypayClearingTotal(client as never, '2026-05-31');
    // Orders 4 (€28.34) + 6 (€122.10) in transit; order 2 (€73.50) settled out.
    expect(total).toBe(15044);
  });

  it('returns 0 when there are no card receipts', async () => {
    const client = buildMockClient({ journal_entries: [{ data: [], error: null }] });
    const total = await getInTransitEverypayClearingTotal(client as never, '2026-05-31');
    expect(total).toBe(0);
  });

  it('subtracts a card cart-time partial refund (C.9) from an in-transit receipt', async () => {
    const client = buildMockClient({
      journal_entries: [
        {
          data: [{ posting_context: { everypay_payment_id: REF_INTRANSIT_1, everypay_charge_cents: 5000 } }],
          error: null
        },
        { data: [], error: null }, // no settlements
        {
          data: [
            { posting_context: { payment_method: 'card', everypay_payment_id: REF_INTRANSIT_1, everypay_refund_cents: 1500 } }
          ],
          error: null
        }
      ]
    });
    const total = await getInTransitEverypayClearingTotal(client as never, '2026-05-31');
    expect(total).toBe(3500); // €50.00 charge − €15.00 card refund
  });
});

// =============================================================================
// getBankClosureReconciliation — period-close item 2 (PR #4b)
// =============================================================================

describe('getBankClosureReconciliation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('classifies each flagged account: pass / fail / skip', async () => {
    const client = buildMockClient({
      accounts: [{ data: [{ code: '2610' }, { code: '2620' }, { code: '2670' }], error: null }],
      journal_lines: [
        {
          data: [
            { account_code: '2610', debit_cents: 38378, credit_cents: 0 },
            { account_code: '2620', debit_cents: 14920, credit_cents: 0 }
            // 2670 has no lines → in-use guard → skip
          ],
          error: null
        }
      ],
      bank_statement_closures: [
        {
          data: [
            { account_code: '2610', closing_balance_cents: 38378 }, // match → pass
            { account_code: '2620', closing_balance_cents: 14000 } //  mismatch → fail
          ],
          error: null
        }
      ]
    });
    const rows = await getBankClosureReconciliation(client as never, '2026-05', '2026-05-31');
    const byCode = Object.fromEntries(rows.map((r) => [r.account_code, r]));
    expect(byCode['2610']!.status).toBe('pass');
    expect(byCode['2620']!.status).toBe('fail');
    expect(byCode['2620']!.gl_closing_cents).toBe(14920);
    expect(byCode['2620']!.recorded_closing_cents).toBe(14000);
    expect(byCode['2670']!.status).toBe('skip');
    expect(byCode['2670']!.has_activity).toBe(false);
  });

  it('returns manual_pending when an in-use account has no recorded closing', async () => {
    const client = buildMockClient({
      accounts: [{ data: [{ code: '2620' }], error: null }],
      journal_lines: [{ data: [{ account_code: '2620', debit_cents: 14920, credit_cents: 0 }], error: null }],
      bank_statement_closures: [{ data: [], error: null }]
    });
    const rows = await getBankClosureReconciliation(client as never, '2026-05', '2026-05-31');
    expect(rows[0]!.status).toBe('manual_pending');
    expect(rows[0]!.gl_closing_cents).toBe(14920);
    expect(rows[0]!.recorded_closing_cents).toBeNull();
  });

  it('returns [] when no accounts are bank-reconcilable', async () => {
    const client = buildMockClient({ accounts: [{ data: [], error: null }] });
    const rows = await getBankClosureReconciliation(client as never, '2026-05', '2026-05-31');
    expect(rows).toEqual([]);
  });
});
