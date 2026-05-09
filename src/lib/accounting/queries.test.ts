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
  getEntriesPostedSince,
  getJournalEntry,
  getPeriodRow,
  getRecentJournalEntries,
  getTrialBalance,
  getWalletIntegrity
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
      lte: vi.fn(),
      gte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn()
    };
    for (const fn of ['select', 'eq', 'in', 'lte', 'gte', 'order', 'limit'] as const) {
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
      seller_id: 'user-A',
      seller_handle: 'Alice',
      gl_balance_cents: 1000,
      wallet_balance_cents: 800,
      delta_cents: 200
    });
    expect(result.per_seller_deltas[1]).toMatchObject({
      seller_id: 'user-C',
      seller_handle: null,
      gl_balance_cents: 0,
      wallet_balance_cents: 100,
      delta_cents: -100
    });
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
    // returns whatever the DB returned in that order.
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

    const rows = await getRecentJournalEntries(client as never, 5);

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
});
