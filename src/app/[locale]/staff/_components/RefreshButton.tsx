'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

/**
 * Soft refresh of the parent Server Component via router.refresh(). Used by
 * the staff Overview action-needed panel; the displayed "Last refreshed"
 * timestamp comes from the server render, so any router.refresh() updates
 * both the row counts and the timestamp in lockstep.
 */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="text-xs text-semantic-brand hover:underline disabled:opacity-50 disabled:cursor-progress"
    >
      {pending ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
