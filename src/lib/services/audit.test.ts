import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const mockCreateServiceClient = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

import { logAuditEvent } from './audit';

function buildMockClient() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ insert });
  return { client: { from } as unknown as SupabaseClient, from, insert };
}

describe('logAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the passed-in client when called with (supabase, event)', async () => {
    const passed = buildMockClient();
    const fallback = buildMockClient();
    mockCreateServiceClient.mockReturnValue(fallback.client);

    await logAuditEvent(passed.client, {
      actorType: 'system',
      action: 'wallet.credit',
      resourceType: 'wallet_transaction',
      resourceId: 'txn-123',
      retentionClass: 'regulatory',
    });

    expect(mockCreateServiceClient).not.toHaveBeenCalled();
    expect(passed.from).toHaveBeenCalledWith('audit_log');
    expect(passed.insert).toHaveBeenCalledTimes(1);
    expect(fallback.from).not.toHaveBeenCalled();
  });

  it('falls through to createServiceClient when called with (event) only', async () => {
    const fallback = buildMockClient();
    mockCreateServiceClient.mockReturnValue(fallback.client);

    await logAuditEvent({
      actorType: 'system',
      action: 'wallet.credit',
      resourceType: 'wallet_transaction',
      resourceId: 'txn-123',
      retentionClass: 'regulatory',
    });

    expect(mockCreateServiceClient).toHaveBeenCalledTimes(1);
    expect(fallback.from).toHaveBeenCalledWith('audit_log');
    expect(fallback.insert).toHaveBeenCalledTimes(1);
  });

  it('writes the same row shape regardless of call form', async () => {
    const passed = buildMockClient();
    const fallback = buildMockClient();
    mockCreateServiceClient.mockReturnValue(fallback.client);

    const event = {
      actorId: 'user-abc',
      actorType: 'user' as const,
      action: 'comment.deleted',
      resourceType: 'listing_comment',
      resourceId: 'comment-1',
      metadata: { reason: 'spam' },
      retentionClass: 'operational' as const,
    };

    await logAuditEvent(passed.client, event);
    await logAuditEvent(event);

    const expectedRow = {
      actor_id: 'user-abc',
      actor_type: 'user',
      action: 'comment.deleted',
      resource_type: 'listing_comment',
      resource_id: 'comment-1',
      metadata: { reason: 'spam' },
      retention_class: 'operational',
    };
    expect(passed.insert).toHaveBeenCalledWith(expectedRow);
    expect(fallback.insert).toHaveBeenCalledWith(expectedRow);
  });

  it('coerces missing actorId, resourceId, and metadata to null/{}', async () => {
    const fallback = buildMockClient();
    mockCreateServiceClient.mockReturnValue(fallback.client);

    await logAuditEvent({
      actorType: 'cron',
      action: 'order.auto_cancelled.response_timeout',
      resourceType: 'order',
      retentionClass: 'regulatory',
    });

    expect(fallback.insert).toHaveBeenCalledWith({
      actor_id: null,
      actor_type: 'cron',
      action: 'order.auto_cancelled.response_timeout',
      resource_type: 'order',
      resource_id: null,
      metadata: {},
      retention_class: 'regulatory',
    });
  });

  it('logs but does not throw when the insert returns an error', async () => {
    const passed = buildMockClient();
    passed.insert.mockResolvedValueOnce({ error: { message: 'rls denied' } });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      logAuditEvent(passed.client, {
        actorType: 'system',
        action: 'wallet.credit',
        resourceType: 'wallet_transaction',
        retentionClass: 'regulatory',
      })
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Audit] Failed to log event:',
      'rls denied',
      'wallet.credit'
    );
    consoleSpy.mockRestore();
  });

  it('logs but does not throw when the insert call itself rejects', async () => {
    const passed = buildMockClient();
    passed.insert.mockRejectedValueOnce(new Error('connection refused'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      logAuditEvent(passed.client, {
        actorType: 'system',
        action: 'wallet.credit',
        resourceType: 'wallet_transaction',
        retentionClass: 'regulatory',
      })
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
