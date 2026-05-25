/**
 * Message digest cron route tests.
 *
 * Covers:
 *  - Auth gate (401 on missing/wrong CRON_SECRET)
 *  - Burst bundling: three messages in one thread, all unread, only one ≥15min old
 *    → exactly ONE Resend call with all three bundled (not three sequential emails)
 *  - Per-bundle commit semantics: first bundle Resend success, second bundle Resend
 *    failure → first bundle's email_sent_at UPDATE fires before the failure;
 *    second bundle's email_send_attempts UPDATE fires.
 *  - Sentry mid-budget warning when any bundle reaches ≥5 attempts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateServiceClient, mockSendEmail, mockSentryCaptureMessage } = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockSendEmail: vi.fn(),
  mockSentryCaptureMessage: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock('@/lib/env', () => ({
  env: {
    cron: { secret: 'test-secret' },
    app: { url: 'http://localhost:3000' },
  },
}));

vi.mock('@/lib/email/service', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: mockSentryCaptureMessage,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const THREAD_ID = '00000000-0000-0000-0000-00000000aaaa';
const USER_A = '00000000-0000-0000-0000-00000000a000';
const USER_B = '00000000-0000-0000-0000-00000000b000';
const NOW = new Date('2026-05-25T12:00:00Z');

function messageRow(opts: {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  email_send_attempts?: number;
  listing_ref_id?: string | null;
  thread: {
    user_a_id: string | null;
    user_b_id: string | null;
    user_a_last_read_at: string | null;
    user_b_last_read_at: string | null;
  };
}) {
  return {
    id: opts.id,
    thread_id: THREAD_ID,
    sender_id: opts.sender_id,
    body: opts.body,
    listing_ref_id: opts.listing_ref_id ?? null,
    created_at: opts.created_at,
    email_send_attempts: opts.email_send_attempts ?? 0,
    message_threads: { id: THREAD_ID, ...opts.thread },
  };
}

// ---------------------------------------------------------------------------
// Supabase chainable mock
//
// The route does:
//   from('messages').select(...).is('email_sent_at', null).lt('email_send_attempts', 10)
//   from('user_profiles').select(...).in('id', recipientIds)
//   from('user_profiles').select(...).in('id', senderIds)
//   from('listings').select(...).in('id', listingIds)   (optional)
//   from('messages').update({email_sent_at}).in('id', ids)
//   from('messages').update({email_send_attempts}).in('id', ids)
//
// We use a router that dispatches by table + method + update payload shape.
// ---------------------------------------------------------------------------

interface SupabaseMockOpts {
  candidateMessages: ReturnType<typeof messageRow>[];
  recipientProfiles: { id: string; full_name: string | null; email: string | null }[];
  senderProfiles: { id: string; full_name: string | null }[];
  listings?: { id: string; game_name: string }[];
  /** Capture all UPDATE calls so tests can assert order + payloads. */
  updates: Array<{ kind: 'sent' | 'attempts'; ids: string[] }>;
}

function makeSupabaseMock(opts: SupabaseMockOpts) {
  function chain(initial: { table: string; isUpdate?: boolean; updatePayload?: Record<string, unknown> }) {
    const state: typeof initial = { ...initial };
    const builder: Record<string, unknown> = {};

    builder.select = vi.fn(() => builder);
    builder.is = vi.fn(() => builder);
    builder.lt = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.update = vi.fn((payload: Record<string, unknown>) => {
      state.isUpdate = true;
      state.updatePayload = payload;
      return builder;
    });
    builder.in = vi.fn((_col: string, ids: string[]) => {
      // Update branch — resolve to {error: null} and capture the call.
      if (state.isUpdate && state.table === 'messages') {
        const payload = state.updatePayload ?? {};
        const kind: 'sent' | 'attempts' =
          'email_sent_at' in payload ? 'sent' : 'attempts';
        opts.updates.push({ kind, ids });
        return Promise.resolve({ data: null, error: null });
      }
      // Read branch — return the matching fixture per table.
      if (state.table === 'user_profiles') {
        // Disambiguate recipient vs sender lookup by column shape: recipient
        // query selects 'email' too. Both call .in('id', ids); we serve the
        // fixture that intersects with the requested ids.
        const fromRecipients = opts.recipientProfiles.filter((p) => ids.includes(p.id));
        const fromSenders = opts.senderProfiles.filter((p) => ids.includes(p.id));
        // Whichever fixture has matches wins. If both match, recipients take
        // priority (the route fires recipients first in the Promise.all batch).
        const data = fromRecipients.length > 0 ? fromRecipients : fromSenders;
        return Promise.resolve({ data, error: null });
      }
      if (state.table === 'listings') {
        const data = (opts.listings ?? []).filter((l) => ids.includes(l.id));
        return Promise.resolve({ data, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });

    // The initial messages SELECT awaits the builder itself (no .in() terminator).
    if (state.table === 'messages' && !state.isUpdate) {
      // Make builder thenable so `await query` resolves to candidates.
      (builder as { then?: unknown }).then = (resolve: (v: unknown) => void) =>
        resolve({ data: opts.candidateMessages, error: null });
    }
    return builder;
  }

  return {
    from: vi.fn((table: string) => chain({ table })),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(secret = 'test-secret'): Request {
  return new Request('http://localhost:3000/api/cron/message-digest', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/cron/message-digest', () => {
  it('returns 401 without the cron secret', async () => {
    const { POST } = await import('./route');
    const res = await POST(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('bundles three burst messages in one thread into a single email', async () => {
    // Burst pattern: T=0 (12 min ago), T=8 (4 min ago), T=14 (1 min ago).
    // Only the T=0 message is ≥15min old? Actually let's use a real burst:
    //   msg1 at NOW-20min  (≥15min — triggers eligibility)
    //   msg2 at NOW-10min  (<15min — joins the bundle anyway, by design)
    //   msg3 at NOW-3min   (<15min — joins the bundle anyway, by design)
    const thread = {
      user_a_id: USER_A,
      user_b_id: USER_B,
      user_a_last_read_at: null, // user_a (recipient) hasn't read anything
      user_b_last_read_at: '2026-05-25T11:00:00Z', // user_b (sender) has caught up
    };
    const updates: SupabaseMockOpts['updates'] = [];
    mockCreateServiceClient.mockReturnValue(
      makeSupabaseMock({
        candidateMessages: [
          messageRow({
            id: 'msg-1',
            body: 'first',
            sender_id: USER_B,
            created_at: new Date(NOW.getTime() - 20 * 60_000).toISOString(),
            thread,
          }),
          messageRow({
            id: 'msg-2',
            body: 'second',
            sender_id: USER_B,
            created_at: new Date(NOW.getTime() - 10 * 60_000).toISOString(),
            thread,
          }),
          messageRow({
            id: 'msg-3',
            body: 'third',
            sender_id: USER_B,
            created_at: new Date(NOW.getTime() - 3 * 60_000).toISOString(),
            thread,
          }),
        ],
        recipientProfiles: [{ id: USER_A, full_name: 'Anna', email: 'anna@example.com' }],
        senderProfiles: [{ id: USER_B, full_name: 'Toms' }],
        updates,
      }),
    );
    mockSendEmail.mockResolvedValue({ id: 'resend-id-1' });

    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ processed: 1, sent: 1, failed: 0 });
    // ONE Resend call, not three.
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const sendArgs = mockSendEmail.mock.calls[0][0];
    expect(sendArgs.to).toBe('anna@example.com');
    expect(sendArgs.subject).toBe('Toms sent you 3 messages');
    // Per-bundle commit: ONE UPDATE marking all three as sent — proves the
    // three messages were bundled into the single Resend call above (not
    // three separate emails, each with its own commit).
    expect(updates).toEqual([{ kind: 'sent', ids: ['msg-1', 'msg-2', 'msg-3'] }]);
  });

  it('per-bundle commit semantics — success-then-failure across two bundles', async () => {
    const SECOND_THREAD = '00000000-0000-0000-0000-00000000bbbb';
    const USER_C = '00000000-0000-0000-0000-00000000c000';
    const USER_D = '00000000-0000-0000-0000-00000000d000';

    const thread1 = {
      user_a_id: USER_A,
      user_b_id: USER_B,
      user_a_last_read_at: null,
      user_b_last_read_at: '2026-05-25T11:00:00Z',
    };
    const thread2 = {
      user_a_id: USER_C,
      user_b_id: USER_D,
      user_a_last_read_at: null,
      user_b_last_read_at: '2026-05-25T11:00:00Z',
    };
    const updates: SupabaseMockOpts['updates'] = [];

    // Two threads, each with one eligible message ≥15min old. Recipient is user_a
    // of each thread; sender is user_b.
    const msgA = {
      ...messageRow({
        id: 'msg-bundle1',
        body: 'bundle 1',
        sender_id: USER_B,
        created_at: new Date(NOW.getTime() - 20 * 60_000).toISOString(),
        thread: thread1,
      }),
    };
    const msgB = {
      ...messageRow({
        id: 'msg-bundle2',
        body: 'bundle 2',
        sender_id: USER_D,
        created_at: new Date(NOW.getTime() - 20 * 60_000).toISOString(),
        thread: thread2,
        email_send_attempts: 4, // already tried 4 times — failure pushes us to 5 → Sentry fires
      }),
      thread_id: SECOND_THREAD,
      message_threads: { id: SECOND_THREAD, ...thread2 },
    };

    mockCreateServiceClient.mockReturnValue(
      makeSupabaseMock({
        candidateMessages: [msgA, msgB],
        recipientProfiles: [
          { id: USER_A, full_name: 'Anna', email: 'anna@example.com' },
          { id: USER_C, full_name: 'Karl', email: 'karl@example.com' },
        ],
        senderProfiles: [
          { id: USER_B, full_name: 'Toms' },
          { id: USER_D, full_name: 'Lina' },
        ],
        updates,
      }),
    );
    // First Resend call succeeds, second fails (returns null).
    mockSendEmail.mockResolvedValueOnce({ id: 'resend-1' });
    mockSendEmail.mockResolvedValueOnce(null);

    const { POST } = await import('./route');
    const res = await POST(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ processed: 2, sent: 1, failed: 1 });
    expect(mockSendEmail).toHaveBeenCalledTimes(2);

    // Per-bundle commits: BOTH fired. Order: bundle1 sent UPDATE first,
    // then bundle2 attempts UPDATE.
    expect(updates).toHaveLength(2);
    expect(updates[0]).toEqual({ kind: 'sent', ids: ['msg-bundle1'] });
    expect(updates[1]).toEqual({ kind: 'attempts', ids: ['msg-bundle2'] });

    // Mid-budget warning: attempts went from 4 → 5, triggers Sentry.
    expect(mockSentryCaptureMessage).toHaveBeenCalledTimes(1);
    const sentryArgs = mockSentryCaptureMessage.mock.calls[0];
    expect(sentryArgs[0]).toMatch(/digest delivery is failing/i);
    expect(sentryArgs[1]?.level).toBe('warning');
  });
});
