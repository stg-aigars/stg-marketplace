'use client';

import { useEffect, useRef } from 'react';
import { trackClient } from '@/lib/analytics';

// Semantics: `resultCount` is the TOTAL matches for the query across all pages,
// not the items rendered on the current page. Using total matches means
// paginating the same query does NOT re-fire (dedup key stays stable), while
// filter changes that alter the total correctly fire a fresh impression.
export function BrowseSearchAnalytics({ query, resultCount }: { query: string; resultCount: number }) {
  const lastFired = useRef<string | null>(null);

  useEffect(() => {
    if (!query) return;
    const key = `${query}::${resultCount}`;
    if (lastFired.current === key) return;
    lastFired.current = key;
    trackClient('search_performed', { query, result_count: resultCount });
  }, [query, resultCount]);

  return null;
}
