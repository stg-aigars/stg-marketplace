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
  }, [listingIds, searchParams]);

  return null;
}
