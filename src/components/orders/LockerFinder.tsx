'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { MagnifyingGlass, SpinnerGap } from '@phosphor-icons/react/ssr';
import type { TerminalOption, TerminalCountry } from '@/lib/services/unisend/types';
import { filterTerminals } from '@/lib/services/unisend/filter-terminals';

// Dynamically import the map (Mapbox) to avoid SSR issues and keep it out of the
// initial bundle — only mounts once the finder is expanded and terminals exist.
const TerminalMap = dynamic(() => import('@/components/checkout/TerminalMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-lg border border-semantic-border-default bg-semantic-bg-secondary flex items-center justify-center" role="status">
      <SpinnerGap className="w-6 h-6 animate-spin text-semantic-brand" aria-hidden="true" />
      <span className="ml-2 text-sm text-semantic-text-secondary">Loading map...</span>
    </div>
  ),
});

interface LockerFinderProps {
  terminals: TerminalOption[];
  country: TerminalCountry;
}

// Read-only finder: in popupAction="directions" mode the popup shows a "Get
// directions" link instead of a Select button, so onSelect is never invoked.
const NOOP = () => {};

export function LockerFinder({ terminals, country }: LockerFinderProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => filterTerminals(terminals, query), [terminals, query]);

  if (terminals.length === 0) {
    return (
      <p className="text-sm text-semantic-text-secondary" role="status">
        The locker map isn&apos;t loading right now. You can still drop your parcel at any
        compatible parcel locker.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <MagnifyingGlass
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-semantic-text-muted"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lockers..."
          aria-label="Search lockers"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-semantic-border-default bg-semantic-bg-primary text-sm text-semantic-text-heading placeholder-semantic-text-muted focus:border-semantic-brand focus:ring-2 focus:ring-semantic-brand/20 outline-none transition-all duration-250 ease-out-custom"
        />
      </div>
      <TerminalMap
        terminals={filtered}
        selectedTerminal={null}
        onSelect={NOOP}
        country={country}
        popupAction="directions"
      />
    </div>
  );
}
