'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Checkbox } from '@/components/ui';

/**
 * Toggle for the `includeBackfill` search-param consumed by the trial-balance
 * and P&L pages. Default is included (checked); only `?includeBackfill=false`
 * excludes Phase 0 backfill entries (per CLAUDE.md, those are tagged with
 * `posting_context.backfill = true` and live in real periods).
 *
 * Preserves all other query params (e.g. `asOf`, `from`, `to`) on toggle.
 */
export function BackfillFilterToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Absent or any value other than 'false' → checked (include).
  const checked = searchParams.get('includeBackfill') !== 'false';

  const handleChange = useCallback(
    (next: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === false) {
        params.set('includeBackfill', 'false');
      } else {
        // Default state is included — drop the param to keep URLs clean.
        params.delete('includeBackfill');
      }
      const query = params.toString();
      router.replace(query ? `?${query}` : '?');
    },
    [router, searchParams],
  );

  return (
    <Checkbox checked={checked} onChange={handleChange}>
      Include backfill entries
    </Checkbox>
  );
}
