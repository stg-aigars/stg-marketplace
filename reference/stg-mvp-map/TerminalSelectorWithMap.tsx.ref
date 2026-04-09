'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Search, LocationPin as MapPin, Check, RefreshCw as Loader2, Map as MapIcon, ListBulleted as List, ChevronDown, X } from '@/lib/icons';
import type { Terminal, TerminalCountry } from '@/lib/unisend/types';
import { useTranslations } from 'next-intl';

// Dynamically import the map component to avoid SSR issues and reduce initial bundle
const TerminalMap = dynamic(() => import('./TerminalMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-lg border border-border bg-bg-secondary flex items-center justify-center" role="status">
      <div className="text-center">
        <Loader2 className="w-6 h-6 animate-spin text-frost-ice mx-auto mb-2" />
        <span className="text-sm text-text-secondary">Loading map...</span>
      </div>
    </div>
  ),
});
// Note: The loading text above cannot use translations because it's outside the component

interface TerminalSelectorWithMapProps {
  defaultCountry: TerminalCountry;
  selectedTerminal: Terminal | null;
  onSelect: (terminal: Terminal) => void;
  error?: string;
}

const COUNTRY_FLAGS: Record<TerminalCountry, string> = {
  LT: 'fi fi-lt',
  LV: 'fi fi-lv',
  EE: 'fi fi-ee',
};

type ViewMode = 'map' | 'list';

export function TerminalSelectorWithMap({
  defaultCountry,
  selectedTerminal,
  onSelect,
  error,
}: TerminalSelectorWithMapProps) {
  const t = useTranslations('Checkout.TerminalSelector');
  // Internal country state (auto-switches on cross-country terminal selection)
  const [country, setCountry] = useState<TerminalCountry>(defaultCountry);
  // All terminals across all countries
  const [allTerminals, setAllTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Independent search states for map and list
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [showTerminalList, setShowTerminalList] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const fetchStarted = useRef(false);

  // Fetch all terminals from all countries on mount (single API call)
  useEffect(() => {
    if (fetchStarted.current && retryCount === 0) return;
    fetchStarted.current = true;

    const fetchTerminals = async () => {
      setLoading(true);
      setFetchError(null);

      try {
        const response = await fetch('/api/shipping/terminals/all');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch terminals');
        }

        setAllTerminals(data.terminals || []);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Failed to load terminals');
        setAllTerminals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTerminals();
  }, [retryCount]);

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
  const handleTerminalSelect = useCallback((terminal: Terminal) => {
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
    const source = allTerminals;
    if (!listSearchQuery.trim()) return source;

    const query = listSearchQuery.toLowerCase();
    return source.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.address.toLowerCase().includes(query) ||
        t.city.toLowerCase().includes(query)
    );
  }, [allTerminals, listSearchQuery]);

  // Group terminals by city (for full list view) — flat across all countries
  const terminalsByCity = useMemo(() => {
    const grouped: Record<string, Terminal[]> = {};
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
      <div className="absolute left-0 right-0 mt-1 bg-white/95 backdrop-blur-sm border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto z-30">
        {searchResults.slice(0, 8).map((terminal) => (
          <button
            key={terminal.id}
            type="button"
            onClick={() => handleTerminalSelect(terminal)}
            className={`w-full text-left px-3 py-2.5 hover:bg-frost-ice/10 transition-colors border-b border-border-subtle last:border-b-0 ${
              selectedTerminal?.id === terminal.id ? 'bg-frost-ice/5' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`${COUNTRY_FLAGS[terminal.countryCode as TerminalCountry]} text-sm flex-shrink-0`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-polar-night">{terminal.name}</p>
                <p className="text-xs text-text-secondary">{terminal.address}, {terminal.city}</p>
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
          <Loader2 className="w-6 h-6 animate-spin text-frost-ice" aria-hidden="true" />
          <span className="ml-2 text-text-secondary">{t('loadingTerminals')}</span>
        </div>
      ) : fetchError ? (
        <div className="text-center py-8 text-aurora-red" role="alert">
          <p>{fetchError}</p>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="mt-2 text-sm text-frost-ice hover:underline min-h-[32px] px-3 py-1"
          >
            {t('tryAgain')}
          </button>
        </div>
      ) : filteredTerminals.length === 0 ? (
        <div className="text-center py-8 text-text-secondary" role="status">
          {listSearchQuery
            ? t('noTerminalsFound')
            : t('noTerminalsAvailable')}
        </div>
      ) : (
        <div className="overflow-y-auto space-y-4 pr-1" style={{ maxHeight }}>
          {terminalsByCity.map(([city, cityTerminals]) => (
            <div key={city}>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                {city}
              </h4>
              <div className="space-y-2">
                {cityTerminals.map((terminal) => (
                  <button
                    key={terminal.id}
                    type="button"
                    onClick={() => handleTerminalSelect(terminal)}
                    className={`
                      w-full text-left p-3 rounded-lg border-2 transition-all
                      ${
                        selectedTerminal?.id === terminal.id
                          ? 'border-frost-ice bg-frost-ice/5 ring-2 ring-frost-ice/20'
                          : 'border-border hover:border-frost-ice/50 hover:bg-bg-secondary'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-frost-ice flex-shrink-0 mt-0.5" />
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`${COUNTRY_FLAGS[terminal.countryCode as TerminalCountry]} text-sm flex-shrink-0`} aria-hidden="true" />
                          <span className="font-medium text-polar-night">
                            {terminal.name}
                          </span>
                          {selectedTerminal?.id === terminal.id && (
                            <Check className="w-4 h-4 text-frost-ice flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-text-secondary mt-0.5">
                          {terminal.address}, {terminal.postalCode}
                        </p>
                        {terminal.comment && (
                          <p className="text-xs text-frost-ice mt-1 italic">
                            {terminal.comment}
                          </p>
                        )}
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
      <div className="lg:hidden flex rounded-lg border border-border p-1 bg-bg-secondary">
        <button
          type="button"
          onClick={() => setViewMode('map')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'map'
              ? 'bg-white text-polar-night shadow-sm'
              : 'text-text-secondary hover:text-polar-night'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          {t('map')}
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode('list');
            setShowTerminalList(true);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'list'
              ? 'bg-white text-polar-night shadow-sm'
              : 'text-text-secondary hover:text-polar-night'
          }`}
        >
          <List className="w-4 h-4" />
          {t('allTerminals')}
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" aria-hidden="true" />
              <input
                type="text"
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-border bg-white/95 backdrop-blur-sm text-sm text-polar-night placeholder-text-muted focus:border-frost-ice focus:ring-2 focus:ring-frost-ice/20 outline-none transition-all shadow-sm"
              />
              {mapSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMapSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-polar-night"
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
          <div className="mt-3 p-3 rounded-lg bg-aurora-green/10 border border-aurora-green/20">
            <div className="flex items-center gap-2 text-aurora-green text-sm">
              <Check className="w-4 h-4" />
              <span className="font-medium">{t('selected')}</span>
            </div>
            <p className="text-sm text-polar-night mt-1">
              {selectedTerminal.name}
            </p>
            <p className="text-xs text-text-secondary">
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" aria-hidden="true" />
            <input
              type="text"
              value={listSearchQuery}
              onChange={(e) => setListSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-bg-primary text-polar-night placeholder-text-muted focus:border-frost-ice focus:ring-2 focus:ring-frost-ice/20 outline-none transition-all min-h-[48px]"
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={mapSearchQuery}
                onChange={(e) => setMapSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-border bg-white/95 backdrop-blur-sm text-sm text-polar-night placeholder-text-muted focus:border-frost-ice focus:ring-2 focus:ring-frost-ice/20 outline-none transition-all shadow-sm"
              />
              {mapSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMapSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-polar-night"
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
          <div className="p-3 rounded-lg bg-aurora-green/10 border border-aurora-green/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-aurora-green text-sm">
                <Check className="w-4 h-4" />
                <span className="font-medium">{t('selectedTerminal')}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTerminalList(true)}
                className="text-xs text-frost-ice hover:underline"
              >
                {t('showAllTerminals')}
              </button>
            </div>
            <p className="text-sm text-polar-night mt-1">
              {selectedTerminal.name} — {selectedTerminal.address}, {selectedTerminal.city}
            </p>
          </div>
        )}

        {/* "Show all terminals" button (when no terminal selected and list hidden) */}
        {!selectedTerminal && !showTerminalList && (
          <button
            type="button"
            onClick={() => setShowTerminalList(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-frost-ice hover:text-frost-iceDark font-medium border border-border rounded-lg hover:bg-frost-ice/5 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
            {t('showAllTerminals')}
          </button>
        )}

        {/* Full terminal list (collapsed by default) */}
        {showTerminalList && (
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="terminal-search-full" className="text-sm font-medium text-polar-night">
                {t('findTerminal')}
              </label>
              <button
                type="button"
                onClick={() => setShowTerminalList(false)}
                className="text-xs text-text-muted hover:text-polar-night"
              >
                {t('hideList')}
              </button>
            </div>
            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" aria-hidden="true" />
                <input
                  id="terminal-search-full"
                  type="text"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  aria-label={t('searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-bg-primary text-polar-night placeholder-text-muted focus:border-frost-ice focus:ring-2 focus:ring-frost-ice/20 outline-none transition-all"
                />
              </div>
            </div>
            <TerminalList maxHeight="350px" />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-aurora-red" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default TerminalSelectorWithMap;
