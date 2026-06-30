import { describe, it, expect, vi, afterEach } from 'vitest';
import { withStorageRetry } from './retry';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Builds a StorageApiError-shaped object as returned on `{ data, error }`. */
function storageApiError(status: number, message = 'boom') {
  return { name: 'StorageApiError', status, message };
}

const TRANSIENT = storageApiError(500, 'Too many connections issued to the database');

describe('withStorageRetry', () => {
  it('retries a transient error then returns the eventual success', async () => {
    vi.useFakeTimers();
    const op = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: TRANSIENT })
      .mockResolvedValueOnce({ data: { path: 'ok' }, error: null });

    const promise = withStorageRetry<{ data: { path: string } | null; error: unknown }>(op);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(op).toHaveBeenCalledTimes(2);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ path: 'ok' });
    expect(result.attempts).toBe(2);
  });

  it('exhausts after the max attempts and returns the last error', async () => {
    vi.useFakeTimers();
    const op = vi.fn().mockResolvedValue({ data: null, error: TRANSIENT });
    const onRetriesExhausted = vi.fn();

    const promise = withStorageRetry(op, { onRetriesExhausted });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(op).toHaveBeenCalledTimes(3);
    expect(result.error).toBe(TRANSIENT);
    expect(result.attempts).toBe(3);
    expect(onRetriesExhausted).toHaveBeenCalledTimes(1);
    expect(onRetriesExhausted).toHaveBeenCalledWith({ attempts: 3, error: TRANSIENT });
  });

  it('does not retry a non-transient error (e.g. 403 RLS)', async () => {
    const op = vi.fn().mockResolvedValue({
      data: null,
      error: storageApiError(403, 'new row violates row-level security policy'),
    });

    const result = await withStorageRetry(op);

    expect(op).toHaveBeenCalledTimes(1);
    expect(result.error).toMatchObject({ status: 403 });
    expect(result.attempts).toBe(1);
  });

  it('does not retry a non-API error class', async () => {
    const op = vi.fn().mockResolvedValue({
      data: null,
      // StorageUnknownError (network/realm failure) is not the pool case.
      error: { name: 'StorageUnknownError', message: 'too many connections' },
    });

    const result = await withStorageRetry(op);

    expect(op).toHaveBeenCalledTimes(1);
    expect(result.attempts).toBe(1);
  });

  it('returns immediately on success without retrying', async () => {
    const op = vi.fn().mockResolvedValue({ data: { path: 'ok' }, error: null });

    const result = await withStorageRetry<{ data: { path: string } | null; error: unknown }>(op);

    expect(op).toHaveBeenCalledTimes(1);
    expect(result.attempts).toBe(1);
    expect(result.data).toEqual({ path: 'ok' });
  });

  it('matches the pool error by message when status is absent', async () => {
    vi.useFakeTimers();
    const op = vi.fn().mockResolvedValue({
      data: null,
      error: { name: 'StorageApiError', message: 'Too many connections issued to the database' },
    });

    const promise = withStorageRetry(op);
    await vi.runAllTimersAsync();
    await promise;

    expect(op).toHaveBeenCalledTimes(3);
  });

  it('waits on the backoff timer between attempts rather than spinning', async () => {
    vi.useFakeTimers();
    const op = vi.fn().mockResolvedValue({ data: null, error: TRANSIENT });

    const promise = withStorageRetry(op);
    // Let the first attempt resolve; the retry is now parked on a timer.
    await Promise.resolve();
    await Promise.resolve();
    expect(op).toHaveBeenCalledTimes(1);

    await vi.runAllTimersAsync();
    await promise;
    expect(op).toHaveBeenCalledTimes(3);
  });
});
