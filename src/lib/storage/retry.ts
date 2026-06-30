/**
 * Retry wrapper for Supabase Storage operations that hit a transient
 * service-side failure.
 *
 * The Supabase Storage service runs its own internal Postgres connection pool
 * (separate from our app pooler). On a burst of concurrent storage operations —
 * e.g. a seller uploading a batch of listing photos — that pool can momentarily
 * exhaust and the service returns "Too many connections issued to the database"
 * (Sentry STG-MARKETPLACE-1J). It clears in well under a second, so a short
 * jittered retry turns a user-visible "photo failed to upload" into a silent
 * recovery.
 *
 * Both `.list()` and `.upload()` *return* the `StorageError` on the `{ data,
 * error }` result — they do not throw — so this wrapper inspects `result.error`
 * and re-invokes `op` rather than catching exceptions. The `{ data, error }`
 * contract is preserved unchanged; an `attempts` count is added for diagnostics.
 */

/** HTTP statuses we treat as transient (infra/overload), safe to retry. */
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

export interface WithStorageRetryOptions {
  /** Total attempts including the first try. Default 3 (1 + 2 retries). */
  attempts?: number;
  /** Base backoff in ms before the first retry. Default 150. */
  baseDelayMs?: number;
  /** Upper bound on a single backoff window in ms. Default 600. */
  maxDelayMs?: number;
  /**
   * Invoked once when a retryable error survives all attempts, before the
   * exhausted result is returned. Lets the caller report the final failure to
   * Sentry with attempt context instead of logging every transient blip.
   */
  onRetriesExhausted?: (meta: { attempts: number; error: unknown }) => void;
}

/**
 * Narrowly identifies the transient Storage pool-exhaustion class.
 *
 * `StorageApiError` is the only server-side API error class (everything else is
 * `StorageUnknownError` for network/realm failures or a validation error), so
 * gating on the name first rules out RLS, not-found, and client validation.
 */
function isTransientStorageError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; status?: number; message?: string };

  if (e.name !== 'StorageApiError') return false;

  // Primary signal: the typed HTTP status. Pool exhaustion surfaces as a 5xx /
  // 429 from the storage service; 4xx (other than 429) are caller errors —
  // RLS, validation, not-found — and must not be retried.
  if (typeof e.status === 'number') {
    return TRANSIENT_STATUS.has(e.status);
  }

  // Fallback: storage-js exposes no typed discriminator for pool exhaustion and
  // older error paths may omit `status`. CLAUDE.md prefers typed errors over
  // string matching; this narrowly-scoped substring is the documented exception
  // for this one transient class (see STG-MARKETPLACE-1J).
  return (
    typeof e.message === 'string' &&
    e.message.toLowerCase().includes('too many connections')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `op` and retries it on a transient Storage error using exponential
 * backoff with full jitter. Non-transient errors return immediately. The
 * resolved value is the underlying `{ data, error }` result with an added
 * `attempts` count.
 */
export async function withStorageRetry<R extends { error: unknown }>(
  op: () => PromiseLike<R>,
  opts: WithStorageRetryOptions = {}
): Promise<R & { attempts: number }> {
  const maxAttempts = Math.max(1, opts.attempts ?? 3);
  const baseDelayMs = opts.baseDelayMs ?? 150;
  const maxDelayMs = opts.maxDelayMs ?? 600;

  let result!: R;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    result = await op();

    if (!isTransientStorageError(result.error)) {
      return Object.assign(result, { attempts: attempt });
    }

    if (attempt < maxAttempts) {
      // Full jitter: random point in [0, min(cap, base * 2^(attempt-1))).
      const window = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(Math.random() * window);
    }
  }

  // All attempts exhausted on a transient error.
  opts.onRetriesExhausted?.({ attempts: maxAttempts, error: result.error });
  return Object.assign(result, { attempts: maxAttempts });
}
