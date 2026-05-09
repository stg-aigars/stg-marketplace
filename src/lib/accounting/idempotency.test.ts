import { describe, it, expect, vi } from 'vitest';

import { checkIdempotency } from './idempotency';

interface MockBuilder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function makeMockSupabase(maybeSingleResult: { data: unknown; error: unknown }): {
  client: { from: ReturnType<typeof vi.fn> };
  builder: MockBuilder;
} {
  const builder: MockBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(maybeSingleResult)
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  const client = { from: vi.fn().mockReturnValue(builder) };
  return { client, builder };
}

describe('checkIdempotency', () => {
  it('returns { status: fresh } when no row exists', async () => {
    const { client } = makeMockSupabase({ data: null, error: null });
    const result = await checkIdempotency(
      client as never,
      'order',
      'order_abc123',
      'O.1'
    );
    expect(result).toEqual({ status: 'fresh' });
  });

  it('returns { status: idempotent_skip, entry_id } when row exists', async () => {
    const { client } = makeMockSupabase({
      data: { id: '99999999-9999-9999-9999-999999999999' },
      error: null
    });
    const result = await checkIdempotency(
      client as never,
      'order',
      'order_abc123',
      'O.1'
    );
    expect(result).toEqual({
      status: 'idempotent_skip',
      entry_id: '99999999-9999-9999-9999-999999999999'
    });
  });

  it('queries journal_entries with correct filters', async () => {
    const { client, builder } = makeMockSupabase({ data: null, error: null });
    await checkIdempotency(client as never, 'wallet_withdrawal', 'STG WD-2026-00001', 'C.4');
    expect(client.from).toHaveBeenCalledWith('journal_entries');
    expect(builder.select).toHaveBeenCalledWith('id');
    expect(builder.eq).toHaveBeenCalledWith('source_doc_type', 'wallet_withdrawal');
    expect(builder.eq).toHaveBeenCalledWith('source_doc_id', 'STG WD-2026-00001');
    expect(builder.eq).toHaveBeenCalledWith('type_id', 'C.4');
  });

  it('throws when supabase returns an error', async () => {
    const { client } = makeMockSupabase({
      data: null,
      error: { message: 'connection lost' }
    });
    await expect(
      checkIdempotency(client as never, 'order', 'order_abc', 'O.1')
    ).rejects.toThrow(/Idempotency SELECT failed.*connection lost/);
  });
});
