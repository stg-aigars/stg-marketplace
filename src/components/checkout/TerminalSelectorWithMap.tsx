'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  MagnifyingGlass,
  MapPin,
  Check,
  SpinnerGap,
  MapTrifold,
  List,
  CaretDown,
  X,
} from '@phosphor-icons/react/ssr';
import type { TerminalOption, TerminalCountry } from '@/lib/services/unisend/types';
import { getCountryFlag } from '@/lib/country-utils';

// Dynamically import the map component to avoid SSR issues and reduce initial bundle
const TerminalMap = dynamic(() => import('./TerminalMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-lg border border-semantic-border-default bg-semantic-bg-secondary flex items-center justify-center" role="status">
      <div className="text-center">
        <SpinnerGap className="w-6 h-6 animate-spin text-semantic-brand mx-auto mb-2" />
        <span className="text-sm text-semantic-text-secondary">Loading map...</span>
      </div>
    </div>
  ),
});

interface TerminalSelectorWithMapProps {
  terminals: TerminalOption[];
  defaultCountry: TerminalCountry;
  selectedTerminal: TerminalOption | null;
  onSelect: (terminal: TerminalOption) => void;
  error?: string;
}

type ViewMode = 'map' | 'list';

export function TerminalSelectorWithMap({
  terminals: allTerminals,
  defaultCountry,
  selectedTerminal,
  onSelect,
  error,
}: TerminalSelectorWithMapProps) {
  // Internal country state (auto-switches on cross-country terminal selection)
  const [country, setCountry] = useState<TerminalCountry>(defaultCountry);
  // Independent search states for map and list
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showTerminalList, setShowTerminalList] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Derive loading from empty terminals
  const loading = allTerminals.length === 0;

  // Derive per-country terminals for map display
  const terminals = useMemo(
    () => allTerminals.filter((t) => t.countryCode === country),
    [allTerminals, country]
  );

  // Sync internal country when selectedTerminal changes externally (e.g., preferred terminal)
  useEffect(() => {
    if (selectedTerminal && selectedTerminal.countryCode !== country) {
      setCountry(selectedTerminal.countryCode as TerminalCountry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTerminal]);

  // Handle terminal selection (auto-switch country if needed)
  const handleTerminalSelect = useCallback((terminal: TerminalOption) => {
    if (terminal.countryCode !== country) {
      setCountry(terminal.countryCode as TerminalCountry);
    }
    onSelect(terminal);
    setShowTerminalList(false);
    setMapSearchQuery('');
    setListSearchQuery('');
  }, [country, onSelect]);

  // Map search: search across ALL countries (for map overlay dropdown)
  const searchResults = useMemo(() => {
    if (!mapSearchQuery.trim()) return [];

    const query = mapSearchQuery.toLowerCase();
    return allTerminals.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.address.toLowerCase().includes(query) ||
        t.city.toLowerCase().includes(query)
    );
  }, [allTerminals, mapSearchQuery]);

  // List search: filter across ALL countries (for full list view)
  const filteredTerminals = useMemo(() => {
    if (!listSearchQuery.trim()) return allTerminals;

    const query = listSearchQuery.toLowerCase();
    return allTerminals.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.address.toLowerCase().includes(query) ||
        t.city.toLowerCase().includes(query)
    );
  }, [allTerminals, listSearchQuery]);

  // Group terminals by city (for full list view) — flat across all countries
  const terminalsByCity = useMemo(() => {
    const grouped: Record<string, TerminalOption[]> = {};
    filteredTerminals.forEach((terminal) => {
      if (!grouped[terminal.city]) {
        grouped[terminal.city] = [];
      }
      grouped[terminal.city].push(terminal);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTerminals]);

  // Search results dropdown (for map overlay search)
  const SearchDropdown = () => {
    if (!mapSearchQuery.trim() || searchResults.length === 0) return null;
    return (
      <div className="absolute left-0 right-0 mt-1 bg-white/95 backdrop-blur-sm border border-semantic-border-default rounded-lg shadow-lg max-h-60 overflow-y-auto z-30">
        {searchResults.slice(0, 8).map((terminal) => (
          <button
            key={terminal.id}
            type="button"
            onClick={() => handleTerminalSelect(terminal)}
            className={`w-full text-left px-3 py-2.5 hover:bg-semantic-brand/10 transition-colors duration-250 ease-out-custom border-b border-semantic-border-default last:border-b-0 ${
              selectedTerminal?.id === terminal.id ? 'bg-semantic-brand/5' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`${getCountryFlag(terminal.countryCode)} text-sm flex-shrink-0`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-semantic-text-heading">{terminal.name}</p>
                <p className="text-xs text-semantic-text-secondary">{terminal.address}, {terminal.city}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  // Full terminal list component (all countries, grouped by city)
  const TerminalList = ({ maxHeight = '350px' }: { maxHeight?: string }) => (
    <div className="space-y-2">
      {loading ? (
        <div className="flex items-center justify-center py-8" role="status">
          <SpinnerGap className="w-6 h-6 animate-spin text-semantic-brand" aria-hidden="true" />
          <span className="ml-2 text-semantic-text-secondary">Loading terminals...</span>
        </div>
      ) : filteredTerminals.length === 0 ? (
        <div className="text-center py-8 text-semantic-text-secondary" role="status">
          {listSearchQuery
            ? 'No terminals found'
            : 'No terminals available'}
        </div>
      ) : (
        <div className="overflow-y-auto space-y-4 pr-1" style={{ maxHeight }}>
          {terminalsByCity.map(([city, cityTerminals]) => (
            <div key={city}>
              <h4 className="text-xs font-semibold text-semantic-text-muted uppercase tracking-wide mb-2">
                {city}
              </h4>
              <div className="space-y-2">
                {cityTerminals.map((terminal) => (
                  <button
                    key={terminal.id}
                    type="button"
                    onClick={() => handleTerminalSelect(terminal)}
                    className={`
                      w-full text-left p-3 rounded-lg border-2 transition-all duration-250 ease-out-custom
                      ${
                        selectedTerminal?.id === terminal.id
                          ? 'border-semantic-brand bg-semantic-brand/5 ring-2 ring-semantic-brand/20'
                          : 'border-semantic-border-default hover:border-semantic-brand/50 hover:bg-semantic-bg-secondary'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-semantic-brand flex-shrink-0 mt-0.5" />
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`${getCountryFlag(terminal.countryCode)} text-sm flex-shrink-0`} aria-hidden="true" />
                          <span className="font-medium text-semantic-text-heading">
                            {terminal.name}
                          </span>
                          {selectedTerminal?.id === terminal.id && (
                            <Check className="w-4 h-4 text-semantic-brand flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-semantic-text-secondary mt-0.5">
                          {terminal.address}, {terminal.postalCode}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Mobile: View Toggle */}
      <div className="lg:hidden flex rounded-lg border border-semantic-border-default p-1 bg-semantic-bg-secondary">
        <button
          type="button"
          onClick={() => setViewMode('map')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors duration-250 ease-out-custom ${
            viewMode === 'map'
              ? 'bg-white text-semantic-text-heading shadow-sm'
              : 'text-semantic-text-secondary hover:text-semantic-text-heading'
          }`}
        >
          <MapTrifold className="w-4 h-4" />
          Map
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode('list');
            setShowTerminalList(true);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors duration-250 ease-out-custom ${
            viewMode === 'list'
              ? 'bg-white text-semantic-text-heading shadow-sm'
              : 'text-semantic-text-secondary hover:text-semantic-text-heading'
          }`}
        >
          <List className="w-4 h-4" />
          All terminals
        </button>
      </div>

      {/* Mobile: Map View */}
      <div className={`lg:hidden ${viewMode === 'map' ? 'block' : 'hidden'}`}>
        <div className="relative">
          <TerminalMap
            terminals={terminals}
            selectedTerminal={selectedTerminal}
            onSelect={handleTerminalSelect}
            country={country}
          />

          {/* Floating search bar on mobile map */}
          <div className="absolute top-3 left-3 right-3 z-20">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-semantic-text-muted" aria-hidden="true" />
              <input
                type="text"
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                placeholder="Search terminals..."
                aria-label="Search terminals..."
                className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-semantic-border-default bg-white/95 backdrop-blur-sm text-sm text-semantic-text-heading placeholder-semantic-text-muted focus:border-semantic-brand focus:ring-2 focus:ring-semantic-brand/20 outline-none transition-all duration-250 ease-out-custom shadow-sm"
              />
              {mapSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMapSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-semantic-text-muted hover:text-semantic-text-heading"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <SearchDropdown />
          </div>
        </div>

        {/* Selected terminal confirmation */}
        {selectedTerminal && (
          <div className="mt-3 p-3 rounded-lg bg-semantic-success/10 border border-semantic-success/20">
            <div className="flex items-center gap-2 text-semantic-success text-sm">
              <Check className="w-4 h-4" />
              <span className="font-medium">Selected</span>
            </div>
            <p className="text-sm text-semantic-text-heading mt-1">
              {selectedTerminal.name}
            </p>
            <p className="text-xs text-semantic-text-secondary">
              {selectedTerminal.address}, {selectedTerminal.city}
            </p>
          </div>
        )}
      </div>

      {/* Mobile: List View */}
      <div className={`lg:hidden ${viewMode === 'list' ? 'block' : 'hidden'}`}>
        {/* Search Input */}
        <div className="mb-4">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-semantic-text-muted" aria-hidden="true" />
            <input
              type="text"
              value={listSearchQuery}
              onChange={(e) => setListSearchQuery(e.target.value)}
              placeholder="Search terminals..."
              aria-label="Search terminals..."
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-semantic-border-default bg-semantic-bg-primary text-semantic-text-heading placeholder-semantic-text-muted focus:border-semantic-brand focus:ring-2 focus:ring-semantic-brand/20 outline-none transition-all duration-250 ease-out-custom min-h-[48px]"
            />
          </div>
        </div>
        <TerminalList />
      </div>

      {/* Desktop: Map-First View */}
      <div className="hidden lg:block space-y-3">
        {/* Map with floating search bar */}
        <div className="relative">
          <TerminalMap
            terminals={terminals}
            selectedTerminal={selectedTerminal}
            onSelect={handleTerminalSelect}
            country={country}
          />

          {/* Floating search bar overlay */}
          <div className="absolute top-3 right-3 z-20 w-72">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-semantic-text-muted" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                placeholder="Search terminals..."
                aria-label="Search terminals..."
                className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-semantic-border-default bg-white/95 backdrop-blur-sm text-sm text-semantic-text-heading placeholder-semantic-text-muted focus:border-semantic-brand focus:ring-2 focus:ring-semantic-brand/20 outline-none transition-all duration-250 ease-out-custom shadow-sm"
              />
              {mapSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMapSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-semantic-text-muted hover:text-semantic-text-heading"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <SearchDropdown />
          </div>
        </div>

        {/* Selected terminal confirmation + "Show all" link */}
        {selectedTerminal && !showTerminalList && (
          <div className="p-3 rounded-lg bg-semantic-success/10 border border-semantic-success/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-semantic-success text-sm">
                <Check className="w-4 h-4" />
                <span className="font-medium">Selected terminal</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTerminalList(true)}
                className="text-xs text-semantic-brand hover:underline"
              >
                Show all terminals
              </button>
            </div>
            <p className="text-sm text-semantic-text-heading mt-1">
              {selectedTerminal.name} — {selectedTerminal.address}, {selectedTerminal.city}
            </p>
          </div>
        )}

        {/* "Show all terminals" button (when no terminal selected and list hidden) */}
        {!selectedTerminal && !showTerminalList && (
          <button
            type="button"
            onClick={() => setShowTerminalList(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-semantic-brand hover:text-semantic-brand/80 font-medium border border-semantic-border-default rounded-lg hover:bg-semantic-brand/5 transition-colors duration-250 ease-out-custom"
          >
            <CaretDown className="w-4 h-4" />
            Show all terminals
          </button>
        )}

        {/* Full terminal list (collapsed by default) */}
        {showTerminalList && (
          <div className="border border-semantic-border-default rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="terminal-search-full" className="text-sm font-medium text-semantic-text-heading">
                Find a terminal
              </label>
              <button
                type="button"
                onClick={() => setShowTerminalList(false)}
                className="text-xs text-semantic-text-muted hover:text-semantic-text-heading"
              >
                Hide list
              </button>
            </div>
            <div className="mb-3">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-semantic-text-muted" aria-hidden="true" />
                <input
                  id="terminal-search-full"
                  type="text"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  placeholder="Search terminals..."
                  aria-label="Search terminals..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-semantic-border-default bg-semantic-bg-primary text-semantic-text-heading placeholder-semantic-text-muted focus:border-semantic-brand focus:ring-2 focus:ring-semantic-brand/20 outline-none transition-all duration-250 ease-out-custom"
                />
              </div>
            </div>
            <TerminalList maxHeight="350px" />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-semantic-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default TerminalSelectorWithMap;
