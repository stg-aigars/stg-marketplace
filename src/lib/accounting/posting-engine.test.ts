/**
 * Posting engine unit tests — mocked supabase + audit (PR #2).
 *
 * Integration tests against real local Supabase live in
 * src/test/integration/posting-engine.test.ts and exercise the 7 named
 * scenarios end-to-end. These unit tests focus on engine orchestration
 * behaviour: validation, dispatch, KYC gate invocation, idempotency dedup,
 * RPC error → PostingResult mapping.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PostingEvent } from './types';

// Hoisted mocks. vi.mock() runs before imports, so factory references must
// be hoisted via vi.hoisted() to be available at mock-factory eval time.
const { mockLogAuditEvent, mockSentryCaptureException, mockSentryCaptureMessage } = vi.hoisted(() => ({
  mockLogAuditEvent: vi.fn(),
  mockSentryCaptureException: vi.fn(),
  mockSentryCaptureMessage: vi.fn()
}));

vi.mock('@/lib/services/audit', () => ({
  logAuditEvent: mockLogAuditEvent
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: mockSentryCaptureException,
  captureMessage: mockSentryCaptureMessage
}));

import { emit } from './posting-engine';

// =============================================================================
// Mock Supabase client builder
// =============================================================================

interface MockResponse {
  data: unknown;
  error: unknown;
}

interface MockClient {
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
}

/**
 * Build a mock Supabase client with per-table response queues.
 *
 * tableResponses: maps table name → ordered list of maybeSingle()
 * responses. Each from(table) call dequeues one response from the table's
 * queue. This mirrors how the engine queries tables in sequence
 * (counterparty load, vat_rates lookup, idempotency check).
 *
 * rpcResponse: response from supabase.rpc('insert_journal_entry', ...).
 */
function buildMockClient(
  tableResponses: Record<string, MockResponse[]>,
  rpcResponse: MockResponse = { data: 'fake-entry-uuid', error: null }
): MockClient {
  const queues: Record<string, MockResponse[]> = { ...tableResponses };

  const fromMock = vi.fn((table: string) => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(() => {
        const queue = queues[table] ?? [];
        const next = queue.shift() ?? { data: null, error: null };
        return Promise.resolve(next);
      })
    };
    return builder;
  });

  const rpcMock = vi.fn(() => Promise.resolve(rpcResponse));

  return { from: fromMock, rpc: rpcMock };
}

const lvSellerCounterparty = {
  id: 'cp-lv-seller-uuid',
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

const baseO1Event: PostingEvent = {
  event_type: 'order.completed',
  source_doc_type: 'order',
  source_doc_id: 'order_unit_test_o1',
  posting_date: '2027-01-15',
  accounting_period: '2027-01',
  tax_period: '2027-01',
  narrative: 'O.1 unit test',
  counterparty_id: 'cp-lv-seller-uuid',
  payload: {
    item_value_cents: 10000,
    shipping_value_cents: 500,
    order_id: 'order_unit_test_o1',
    seller_id: 'seller_uuid',
    invoice_number: 'STG-2027-00001',
    test_artifact: true
  }
};

beforeEach(() => {
  // Default audit mock to resolved promise so the engine's .catch() chain works.
  // Per-test overrides via mockResolvedValueOnce / mockRejectedValueOnce.
  mockLogAuditEvent.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// Validation
// =============================================================================

describe('emit — event-shape validation', () => {
  it('rejects missing event_type', async () => {
    const client = buildMockClient({});
    const result = await emit(client as never, { ...baseO1Event, event_type: '' });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error).toContain('event.event_type');
    }
  });

  it('rejects missing source_doc_id', async () => {
    const client = buildMockClient({});
    const result = await emit(client as never, { ...baseO1Event, source_doc_id: '' });
    expect(result.status).toBe('failed');
  });

  it('rejects non-object payload', async () => {
    const client = buildMockClient({});
    const result = await emit(client as never, {
      ...baseO1Event,
      payload: null as unknown as Record<string, unknown>
    });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error).toContain('payload');
    }
  });
});

describe('emit — dispatch validation', () => {
  it('returns failed when no type matches event_type', async () => {
    // No counterparty so loadCounterparty is skipped and dispatch is reached.
    const client = buildMockClient({});
    const result = await emit(client as never, {
      ...baseO1Event,
      event_type: 'unknown.event',
      counterparty_id: undefined
    });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error).toContain('no_matching_type');
    }
  });

  it('returns failed when posting_context_required_keys missing', async () => {
    const client = buildMockClient({
      counterparties: [{ data: lvSellerCounterparty, error: null }]
    });
    const result = await emit(client as never, {
      ...baseO1Event,
      payload: {
        item_value_cents: 10000,
        shipping_value_cents: 500
        // Missing: order_id, seller_id, invoice_number
      }
    });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error).toContain('payload.order_id');
    }
  });
});

// =============================================================================
// Idempotency
// =============================================================================

describe('emit — idempotency dedup', () => {
  it('returns idempotent_skip without calling RPC when entry already exists', async () => {
    const client = buildMockClient({
      counterparties: [{ data: lvSellerCounterparty, error: null }],
      vat_rates: [{ data: { rate: 21.0, valid_from: '2024-01-01', valid_to: null }, error: null }],
      journal_entries: [{ data: { id: 'existing-entry-uuid' }, error: null }]
    });
    const result = await emit(client as never, baseO1Event);
    expect(result).toEqual({
      status: 'idempotent_skip',
      entry_id: 'existing-entry-uuid'
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

// =============================================================================
// KYC gate
// =============================================================================

describe('emit — KYC gate (C.4 only)', () => {
  it('rejects C.4 when seller has pending_kyc status', async () => {
    const blockedSeller = { ...lvSellerCounterparty, legal_compliance_status: 'pending_kyc' };
    const client = buildMockClient({
      // Single counterparties query — engine loads once, KYC gate reuses the row
      counterparties: [{ data: blockedSeller, error: null }]
    });
    const result = await emit(client as never, {
      event_type: 'seller.withdrawal_requested',
      source_doc_type: 'wallet_withdrawal',
      source_doc_id: 'STG WD-TEST-0001',
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      narrative: 'C.4 KYC test',
      counterparty_id: 'cp-lv-seller-uuid',
      payload: {
        withdrawal_cents: 5000,
        seller_id: 'seller_uuid',
        withdrawal_ref: 'STG WD-TEST-0001',
        seller_iban: 'LV80BANK0000435195001'
      }
    });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error).toContain('PostingComplianceGateError');
      expect(result.error).toContain('kyc_gate');
    }
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('passes C.4 when seller has ok status', async () => {
    const client = buildMockClient({
      counterparties: [{ data: lvSellerCounterparty, error: null }],
      journal_entries: [{ data: null, error: null }] // idempotency: fresh
    });
    const result = await emit(client as never, {
      event_type: 'seller.withdrawal_requested',
      source_doc_type: 'wallet_withdrawal',
      source_doc_id: 'STG WD-TEST-0002',
      posting_date: '2027-01-15',
      accounting_period: '2027-01',
      tax_period: '2027-01',
      narrative: 'C.4 happy path',
      counterparty_id: 'cp-lv-seller-uuid',
      payload: {
        withdrawal_cents: 5000,
        seller_id: 'seller_uuid',
        withdrawal_ref: 'STG WD-TEST-0002',
        seller_iban: 'LV80BANK0000435195001'
      }
    });
    expect(result).toEqual({ status: 'created', entry_id: 'fake-entry-uuid' });
    expect(client.rpc).toHaveBeenCalledOnce();
  });
});

// =============================================================================
// RPC error mapping
// =============================================================================

describe('emit — RPC errors', () => {
  it('returns idempotent_skip on unique_violation race recovery', async () => {
    const client = buildMockClient(
      {
        counterparties: [{ data: lvSellerCounterparty, error: null }],
        vat_rates: [{ data: { rate: 21.0, valid_from: '2024-01-01', valid_to: null }, error: null }],
        journal_entries: [
          { data: null, error: null }, // pre-RPC idempotency: fresh
          { data: { id: 'race-winner-uuid' }, error: null } // post-violation recovery: found
        ]
      },
      { data: null, error: { code: '23505', message: 'unique violation on idx_journal_entries_idempotency' } }
    );
    const result = await emit(client as never, baseO1Event);
    expect(result).toEqual({
      status: 'idempotent_skip',
      entry_id: 'race-winner-uuid'
    });
  });

  it('throws PostingIdempotencyConflict when unique fires but recovery empty', async () => {
    const client = buildMockClient(
      {
        counterparties: [{ data: lvSellerCounterparty, error: null }],
        vat_rates: [{ data: { rate: 21.0, valid_from: '2024-01-01', valid_to: null }, error: null }],
        journal_entries: [
          { data: null, error: null }, // pre-RPC: fresh
          { data: null, error: null } // recovery: empty (unrecoverable)
        ]
      },
      { data: null, error: { code: '23505', message: 'unique violation' } }
    );
    await expect(emit(client as never, baseO1Event)).rejects.toThrow(
      'unrecoverable_unique_violation'
    );
    expect(mockSentryCaptureException).toHaveBeenCalled();
  });

  it('returns failed on generic RPC error', async () => {
    const client = buildMockClient(
      {
        counterparties: [{ data: lvSellerCounterparty, error: null }],
        vat_rates: [{ data: { rate: 21.0, valid_from: '2024-01-01', valid_to: null }, error: null }],
        journal_entries: [{ data: null, error: null }]
      },
      { data: null, error: { code: 'P0001', message: 'POSTING:MISSING_KEY foo' } }
    );
    const result = await emit(client as never, baseO1Event);
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error).toContain('POSTING:MISSING_KEY');
    }
  });
});

// =============================================================================
// Audit firing
// =============================================================================

describe('emit — audit log firing', () => {
  it('fires logAuditEvent with regulatory retention on success', async () => {
    const client = buildMockClient({
      counterparties: [{ data: lvSellerCounterparty, error: null }],
      vat_rates: [{ data: { rate: 21.0, valid_from: '2024-01-01', valid_to: null }, error: null }],
      journal_entries: [{ data: null, error: null }]
    });
    mockLogAuditEvent.mockResolvedValue(undefined);
    const result = await emit(client as never, baseO1Event);
    expect(result.status).toBe('created');
    // Allow microtask queue to drain so the fire-and-forget call lands.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'accounting.posted',
        retentionClass: 'regulatory',
        resourceType: 'journal_entry',
        resourceId: 'fake-entry-uuid',
        metadata: expect.objectContaining({
          type_id: 'O.1',
          source_doc_type: 'order',
          source_doc_id: 'order_unit_test_o1'
        })
      })
    );
  });

  it('routes audit-write failures to Sentry as warning (not silent)', async () => {
    const client = buildMockClient({
      counterparties: [{ data: lvSellerCounterparty, error: null }],
      vat_rates: [{ data: { rate: 21.0, valid_from: '2024-01-01', valid_to: null }, error: null }],
      journal_entries: [{ data: null, error: null }]
    });
    mockLogAuditEvent.mockRejectedValueOnce(new Error('audit_log table unavailable'));
    const result = await emit(client as never, baseO1Event);
    expect(result.status).toBe('created');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockSentryCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('accounting.posted audit write failed'),
      'warning'
    );
  });
});
