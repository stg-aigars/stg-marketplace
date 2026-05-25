import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

const mockRequireServerAuth = vi.fn();
const mockCreateClient = vi.fn();
const mockNotifyMany = vi.fn();
const mockLogAuditEvent = vi.fn();

vi.mock('@/lib/auth/helpers', () => ({
  requireServerAuth: (...args: unknown[]) => mockRequireServerAuth(...args),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));
vi.mock('@/lib/notifications', () => ({
  notifyMany: (...args: unknown[]) => mockNotifyMany(...args),
}));
vi.mock('@/lib/services/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Supabase chainable mock — captures update payloads and returns canned
// select results per call site. The slug-lock test only needs:
//   1. select('notified_at').eq('id',x).maybeSingle()   → notifiedAt fixture
//   2. update(payload).eq('id',x)                       → success or error
// ---------------------------------------------------------------------------

interface MockOpts {
  notifiedAt: string | null;
  /** Capture the update payload for assertion. */
  updateCalls: Record<string, unknown>[];
  /** If true, the update().eq() resolves with an error. */
  updateError?: { code?: string; message?: string };
}

function makeSupabaseMock(opts: MockOpts) {
  return {
    from: vi.fn(() => {
      const state: { isUpdate: boolean; updatePayload?: Record<string, unknown> } = {
        isUpdate: false,
      };
      const builder: Record<string, unknown> = {};
      builder.select = vi.fn(() => builder);
      builder.update = vi.fn((payload: Record<string, unknown>) => {
        state.isUpdate = true;
        state.updatePayload = payload;
        return builder;
      });
      builder.eq = vi.fn(() => {
        if (state.isUpdate) {
          opts.updateCalls.push(state.updatePayload ?? {});
          return Promise.resolve({ data: null, error: opts.updateError ?? null });
        }
        return builder;
      });
      builder.maybeSingle = vi.fn(() =>
        Promise.resolve({ data: { notified_at: opts.notifiedAt }, error: null }),
      );
      return builder;
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: staff user passes the gate.
  mockRequireServerAuth.mockResolvedValue({
    user: { id: 'staff-uuid' },
    profile: { is_staff: true },
  });
});

afterEach(() => vi.clearAllMocks());

describe('updateAnnouncement slug-lock invariant', () => {
  it('rejects slug change when notified_at IS NOT NULL', async () => {
    const updates: Record<string, unknown>[] = [];
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ notifiedAt: '2026-05-25T00:00:00Z', updateCalls: updates }),
    );

    const { updateAnnouncement } = await import('./actions');
    const result = await updateAnnouncement('abc', { slug: 'new-slug' });

    expect(result).toEqual({ error: 'slug_locked_after_notify' });
    // No UPDATE should have fired.
    expect(updates).toHaveLength(0);
  });

  it('allows slug change when notified_at IS NULL', async () => {
    const updates: Record<string, unknown>[] = [];
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ notifiedAt: null, updateCalls: updates }),
    );

    const { updateAnnouncement } = await import('./actions');
    const result = await updateAnnouncement('abc', { slug: 'renamed' });

    expect(result).toEqual({ success: true });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ slug: 'renamed' });
  });

  it('allows title + body edits even when notified_at IS NOT NULL', async () => {
    const updates: Record<string, unknown>[] = [];
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ notifiedAt: '2026-05-25T00:00:00Z', updateCalls: updates }),
    );

    const { updateAnnouncement } = await import('./actions');
    const result = await updateAnnouncement('abc', {
      title: 'Updated title',
      bodyMarkdown: 'Updated body',
    });

    expect(result).toEqual({ success: true });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ title: 'Updated title', body_markdown: 'Updated body' });
  });

  it('returns forbidden when caller is not staff', async () => {
    mockRequireServerAuth.mockResolvedValue({
      user: { id: 'random-uuid' },
      profile: { is_staff: false },
    });
    // The action throws before ever touching supabase, so the client mock
    // can be a no-op. We still need it to satisfy the import-time check.
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({ notifiedAt: null, updateCalls: [] }),
    );

    const { updateAnnouncement } = await import('./actions');
    const result = await updateAnnouncement('abc', { title: 'anything' });

    expect(result).toEqual({ error: 'forbidden' });
  });
});
