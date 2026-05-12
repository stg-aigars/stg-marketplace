/**
 * Monthly VAT close cron route tests (PR C commit 12).
 *
 * Covers auth gate, period precondition check, no-movement skip, refund/
 * payable/zero-net emit dispatch, idempotent retry, emit failure
 * propagation. Pure-logic tests for computeTargetPeriod live in
 * vat-close-logic.test.ts; this file tests the I/O orchestration around
 * the helpers.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateServiceClient,
  mockEmit,
  mockGetNetVatPositionForPeriod,
  mockGetPeriodRow,
} = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockEmit: vi.fn(),
  mockGetNetVatPositionForPeriod: vi.fn(),
  mockGetPeriodRow: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock('@/lib/env', () => ({
  env: { cron: { secret: 'test-secret' } },
}));

vi.mock('@/lib/accounting/posting-engine', () => ({
  emit: mockEmit,
}));

vi.mock('@/lib/accounting/queries', () => ({
  getNetVatPositionForPeriod: mockGetNetVatPositionForPeriod,
  getPeriodRow: mockGetPeriodRow,
}));

// Helper — POST request with the configured auth secret
function makeRequest(secret = 'test-secret'): Request {
  return new Request('http://localhost:3000/api/cron/monthly-vat-close', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
}

const openPeriod = {
  period_key: '2026-04',
  period_type: 'month',
  status: 'open',
  locked_at: null,
  locked_by: null,
  created_at: '2026-04-01T00:00:00Z',
};

beforeEach(() => {
  vi.useFakeTimers();
  // Fix "now" to 2026-05-01 01:00 UTC so computeTargetPeriod returns April 2026.
  vi.setSystemTime(new Date(Date.UTC(2026, 4, 1, 1, 0, 0)));
  mockCreateServiceClient.mockReturnValue({});
  mockGetPeriodRow.mockResolvedValue(openPeriod);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('POST /api/cron/monthly-vat-close — auth', () => {
  it('rejects requests with missing Authorization header', async () => {
    const req = new Request('http://localhost:3000/api/cron/monthly-vat-close', { method: 'POST' });
    const { POST } = await import('./route');
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects requests with wrong secret', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/cron/monthly-vat-close — period precondition (Q12-3)', () => {
  it('returns 500 when the previous period is not seeded', async () => {
    mockGetPeriodRow.mockResolvedValueOnce(null);
    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.result.status).toBe('failed');
    expect(body.result.error).toContain('not seeded');
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('returns 500 with failed_period_locked when previous period is soft_locked', async () => {
    mockGetPeriodRow.mockResolvedValueOnce({ ...openPeriod, status: 'soft_locked' });
    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.result.status).toBe('failed_period_locked');
    expect(body.result.error).toContain('soft_locked');
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('returns 500 with failed_period_locked when previous period is hard_locked', async () => {
    mockGetPeriodRow.mockResolvedValueOnce({ ...openPeriod, status: 'hard_locked' });
    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.result.status).toBe('failed_period_locked');
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe('POST /api/cron/monthly-vat-close — no-VAT-movement skip (Q12-5)', () => {
  it('skips emit and returns 200 when both LV-IN and LV-OUT are zero', async () => {
    mockGetNetVatPositionForPeriod.mockResolvedValueOnce({
      period_key: '2026-04',
      has_no_movement: true,
      lv_in_cents: 0,
      lv_out_cents: 0,
      net_payable_to_vid_cents: 0,
      lines: [],
    });
    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.status).toBe('skipped_no_vat_movement');
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

describe('POST /api/cron/monthly-vat-close — emit dispatch', () => {
  it('emits P.1 for a refund-position period (April-shape: lv_out=38, lv_in=68, refund=30)', async () => {
    mockGetNetVatPositionForPeriod.mockResolvedValueOnce({
      period_key: '2026-04',
      has_no_movement: false,
      lv_in_cents: 68,
      lv_out_cents: 38,
      net_payable_to_vid_cents: -30, // negative = refund
      lines: [
        { account_code: '5710-LV-OUT', debit_cents: 38, credit_cents: 0, narrative: 'Clear LV output VAT' },
        { account_code: '5710-LV-IN', debit_cents: 0, credit_cents: 68, narrative: 'Clear LV input VAT' },
        { account_code: '2380', debit_cents: 30, credit_cents: 0, narrative: 'VID receivable' },
      ],
    });
    mockEmit.mockResolvedValueOnce({ status: 'created', entry_id: 'je_p1_apr_2026' });

    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.status).toBe('created');
    expect(body.result.entry_id).toBe('je_p1_apr_2026');
    expect(body.result.net_payable_to_vid_cents).toBe(-30);
    expect(body.result.lines_count).toBe(3);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    const [, event] = mockEmit.mock.calls[0]!;
    expect((event as { event_type: string }).event_type).toBe('period_close.monthly_vat');
    expect((event as { source_doc_id: string }).source_doc_id).toBe('close_2026_04');
    expect((event as { emission_source: string }).emission_source).toBe('cron');
    // Q12-7a — both keys threaded
    const payload = (event as { payload: Record<string, unknown> }).payload;
    expect(payload.net_refund_cents).toBe(30);            // positive = refund per legacy sign
    expect(payload.net_payable_to_vid_cents).toBe(-30);   // negative = refund per direction-explicit sign
  });

  it('emits P.1 for a payable-position period (net_payable > 0)', async () => {
    mockGetNetVatPositionForPeriod.mockResolvedValueOnce({
      period_key: '2026-04',
      has_no_movement: false,
      lv_in_cents: 2000,
      lv_out_cents: 15000,
      net_payable_to_vid_cents: 13000,
      lines: [
        { account_code: '5710-LV-OUT', debit_cents: 15000, credit_cents: 0, narrative: 'A' },
        { account_code: '5710-LV-IN', debit_cents: 0, credit_cents: 2000, narrative: 'B' },
        { account_code: '5710-09', debit_cents: 0, credit_cents: 13000, narrative: 'C' },
      ],
    });
    mockEmit.mockResolvedValueOnce({ status: 'created', entry_id: 'je_p1_payable' });

    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.result.status).toBe('created');
    expect(body.result.net_payable_to_vid_cents).toBe(13000);

    const [, event] = mockEmit.mock.calls[0]!;
    const payload = (event as { payload: Record<string, unknown> }).payload;
    expect(payload.net_refund_cents).toBe(-13000);
    expect(payload.net_payable_to_vid_cents).toBe(13000);
  });

  it('emits P.1 for a zero-net period (lv_in_cents == lv_out_cents, both nonzero)', async () => {
    mockGetNetVatPositionForPeriod.mockResolvedValueOnce({
      period_key: '2026-04',
      has_no_movement: false,
      lv_in_cents: 500,
      lv_out_cents: 500,
      net_payable_to_vid_cents: 0,
      lines: [
        { account_code: '5710-LV-OUT', debit_cents: 500, credit_cents: 0, narrative: 'A' },
        { account_code: '5710-LV-IN', debit_cents: 0, credit_cents: 500, narrative: 'B' },
      ],
    });
    mockEmit.mockResolvedValueOnce({ status: 'created', entry_id: 'je_p1_zero' });

    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.result.status).toBe('created');
    expect(body.result.net_payable_to_vid_cents).toBe(0);
    expect(body.result.lines_count).toBe(2);
  });
});

describe('POST /api/cron/monthly-vat-close — idempotent retry', () => {
  it('returns 200 with status=idempotent_skip when engine recovers from UNIQUE conflict', async () => {
    mockGetNetVatPositionForPeriod.mockResolvedValueOnce({
      period_key: '2026-04',
      has_no_movement: false,
      lv_in_cents: 68,
      lv_out_cents: 38,
      net_payable_to_vid_cents: -30,
      lines: [
        { account_code: '5710-LV-OUT', debit_cents: 38, credit_cents: 0, narrative: 'A' },
        { account_code: '5710-LV-IN', debit_cents: 0, credit_cents: 68, narrative: 'B' },
        { account_code: '2380', debit_cents: 30, credit_cents: 0, narrative: 'C' },
      ],
    });
    mockEmit.mockResolvedValueOnce({ status: 'idempotent_skip', entry_id: 'je_existing' });

    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result.status).toBe('idempotent_skip');
    expect(body.result.entry_id).toBe('je_existing');
  });
});

describe('POST /api/cron/monthly-vat-close — emit failure propagation', () => {
  it('returns 500 when engine emit returns failed', async () => {
    mockGetNetVatPositionForPeriod.mockResolvedValueOnce({
      period_key: '2026-04',
      has_no_movement: false,
      lv_in_cents: 68,
      lv_out_cents: 38,
      net_payable_to_vid_cents: -30,
      lines: [
        { account_code: '5710-LV-OUT', debit_cents: 38, credit_cents: 0, narrative: 'A' },
        { account_code: '5710-LV-IN', debit_cents: 0, credit_cents: 68, narrative: 'B' },
        { account_code: '2380', debit_cents: 30, credit_cents: 0, narrative: 'C' },
      ],
    });
    mockEmit.mockResolvedValueOnce({
      status: 'failed',
      error: 'PostingValidationError[missing_required_key]: P.1 requires payload.lines',
    });

    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.result.status).toBe('failed');
    expect(body.result.error).toContain('PostingValidationError');
  });
});
