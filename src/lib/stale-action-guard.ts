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

  // NOTE: we intentionally do NOT match on error.digest prefixes. NEXT_REDIRECT
  // and NEXT_NOT_FOUND are normal control-flow digests thrown by redirect() and
  // notFound() from server actions — a prefix match on 'NEXT_' would turn every
  // aborted navigation into a full-page reload. If a future Next.js release
  // renames UnrecognizedActionError, add the concrete digest value here —
  // never a prefix.
  return false;
}

/**
 * Detect React's "Rendered more hooks than during the previous render"
 * invariant violation (React error #310). Seen intermittently on [id]-based
 * detail routes (STG-MARKETPLACE-13) during client-side navigation
 * transitions, with no application-level rules-of-hooks violation found after
 * an exhaustive audit — likely a Next.js-vendored React canary edge case. A
 * full reload gives the page a fresh fiber tree and dispatcher state.
 */
export function isRenderedMoreHooksError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const message = (error as { message?: unknown }).message;
  return (
    typeof message === 'string' &&
    message.includes('Rendered more hooks than during the previous render')
  );
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
