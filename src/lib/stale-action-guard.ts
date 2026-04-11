const STORAGE_KEY = 'stg-stale-action-reload';
const COOLDOWN_MS = 30_000;

/**
 * Detect stale server action errors thrown after a deployment.
 * Next.js content-hashes action IDs — old tabs reference stale hashes.
 */
export function isStaleActionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const name = (error as { name?: unknown }).name;
  if (name === 'UnrecognizedActionError') return true;

  const message = (error as { message?: unknown }).message;
  if (
    typeof message === 'string' &&
    message.includes('Server Action') &&
    message.includes('was not found on the server')
  ) {
    return true;
  }

  // Defensive: Next.js attaches framework error digests prefixed with NEXT_ on
  // errors that bubble out of server action RSC responses. Catch them so a
  // renamed / restructured error class still trips the reload path.
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest === 'string' && digest.startsWith('NEXT_')) return true;

  return false;
}

/**
 * Pure read — safe to call during React render.
 * Returns true if a reload was attempted within the last 30 seconds.
 */
export function hasRecentReloadAttempt(): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const timestamp = Number(raw);
    return Date.now() - timestamp < COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Write-only — call from useEffect or event handlers, NOT during render.
 */
export function markReloadAttempt(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (e.g. private browsing quota exceeded)
  }
}

/**
 * Convenience for non-render contexts (event handlers).
 * Checks the loop guard, marks the attempt, and reloads.
 * No-op if a recent reload was already attempted.
 */
export function attemptStaleActionReload(): boolean {
  if (hasRecentReloadAttempt()) return false;
  markReloadAttempt();
  window.location.reload();
  return true;
}
