'use client';

import { useEffect } from 'react';
import { writeBrowseContext } from '@/lib/listings/browse-context';

interface BrowseContextWriterProps {
  listingIds: string[];
  searchParams: string;
}

export function BrowseContextWriter({ listingIds, searchParams }: BrowseContextWriterProps) {
  useEffect(() => {
    writeBrowseContext({ ids: listingIds, searchParams });
    // listingIds is intentionally omitted: it's a new array ref each render,
    // so including it would write on every re-render. We only want to write
    // on mount and when searchParams changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}
