'use client';

import { useEffect } from 'react';
import { writeBrowseContext } from '@/lib/listings/browse-context';

interface BrowseContextWriterProps {
  listingIds: string[];
  searchParams: string;
}

export function BrowseContextWriter({ listingIds, searchParams }: BrowseContextWriterProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- props are stable (server component parent renders once)
  useEffect(() => {
    writeBrowseContext({ ids: listingIds, searchParams });
  }, [searchParams]);

  return null;
}
