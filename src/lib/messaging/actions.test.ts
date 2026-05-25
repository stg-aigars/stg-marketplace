import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

const mockRequireServerAuth = vi.fn();
const mockCreateClient = vi.fn();
const mockNotify = vi.fn();
const mockTrackServer = vi.fn();

vi.mock('@/lib/auth/helpers', () => ({
  requireServerAuth: (...args: unknown[]) => mockRequireServerAuth(...args),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));
vi.mock('@/lib/notifications', () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}));
vi.mock('@/lib/analytics/track-server', () => ({
  trackServer: (...args: unknown[]) => mockTrackServer(...args),
}));

// ---------------------------------------------------------------------------
// Helpers — chainable mock of supabase.from('listings').select(...).eq(...).maybeSingle()
// and supabase.rpc('send_first_message', ...)
// ---------------------------------------------------------------------------

function makeSupabaseMock(opts: {
  rpcResult: { data: unknown; error: unknown };
  listingFetchResult?: { data: { game_name: string | null } | null; error: unknown };
}) {
  const maybeSingle = vi.fn().mockResolvedValue(opts.listingFetchResult ?? { data: null, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi.fn().mockResolvedValue(opts.rpcResult);
  return { from, rpc };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendFirstMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireServerAuth.mockResolvedValue({
      user: { id: 'sender-uuid' },
      profile: { full_name: 'Sender Name' },
    });
  });

  it('surfaces RPC self_target discriminator without firing side effects', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ rpcResult: { data: { ok: false, error: 'self_target' }, error: null } }),
    );

    const { sendFirstMessage } = await import('./actions');
    const result = await sendFirstMessage({
      otherUserId: 'sender-uuid',
      body: 'hi',
      entryPoint: 'listing_detail',
    });

    expect(result).toEqual({ ok: false, error: 'self_target' });
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockTrackServer).not.toHaveBeenCalled();
  });

  it('fires notify and both analytics events on success, with sender.id as distinctId', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({
        rpcResult: { data: { ok: true, thread_id: 'thread-1', message_id: 'msg-1' }, error: null },
        listingFetchResult: { data: { game_name: 'Catan' }, error: null },
      }),
    );

    const { sendFirstMessage } = await import('./actions');
    const result = await sendFirstMessage({
      otherUserId: 'other-uuid',
      body: 'hi',
      listingRefId: 'listing-1',
      entryPoint: 'listing_detail',
    });

    expect(result).toEqual({ ok: true, thread_id: 'thread-1', message_id: 'msg-1' });
    expect(mockNotify).toHaveBeenCalledWith('other-uuid', 'message.received', {
      threadId: 'thread-1',
      listingId: 'listing-1',
      senderName: 'Sender Name',
      gameName: 'Catan',
    });
    expect(mockTrackServer).toHaveBeenCalledWith('message_thread_started', 'sender-uuid', {
      thread_id: 'thread-1',
      entry_point: 'listing_detail',
      has_listing_ref: true,
    });
    expect(mockTrackServer).toHaveBeenCalledWith('message_sent', 'sender-uuid', {
      thread_id: 'thread-1',
      is_first_message: true,
      has_listing_ref: true,
    });
  });

  it('returns cannot_message_user when the RPC call itself errors', async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ rpcResult: { data: null, error: { message: 'rpc failure' } } }),
    );

    const { sendFirstMessage } = await import('./actions');
    const result = await sendFirstMessage({
      otherUserId: 'other-uuid',
      body: 'hi',
      entryPoint: 'seller_profile',
    });

    expect(result).toEqual({ ok: false, error: 'cannot_message_user' });
    expect(mockNotify).not.toHaveBeenCalled();
    expect(mockTrackServer).not.toHaveBeenCalled();
  });
});
