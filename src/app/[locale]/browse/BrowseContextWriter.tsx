'use client';

import { useEffect } from 'react';
import { writeBrowseContext } from '@/lib/listings/browse-context';

interface BrowseContextWriterProps {
  listingIds: string[];
  searchParams: string;
}

export function BrowseContextWriter({ listingIds, searchParams }: BrowseContextWriterProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- write-on-mount only; listingIds omitted because it's a new array ref each render
  useEffect(() => {
    writeBrowseContext({ ids: listingIds, searchParams });
  }, [searchParams]);

  return null;
}
