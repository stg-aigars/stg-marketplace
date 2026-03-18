'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Button } from '@/components/ui';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, LISTING_CONDITIONS, type ListingCondition } from '@/lib/listings/types';
import { COUNTRIES, type CountryCode } from '@/lib/country-utils';
import {
  type BrowseFilters as BrowseFiltersType,
  type SortOption,
  filtersToSearchParams,
  countActiveFilters,
  DEFAULT_FILTERS,
} from '@/lib/listings/filters';

interface BrowseFiltersProps {
  currentFilters: BrowseFiltersType;
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

// Map condition DB values to badge CSS classes for chip styling
const conditionChipClasses: Record<string, { active: string; inactive: string }> = {
  likeNew: {
    active: 'bg-condition-like-new-bg text-condition-like-new-text border-condition-like-new border-2',
    inactive: 'bg-semantic-bg-elevated text-semantic-text-secondary border border-semantic-border-default',
  },
  veryGood: {
    active: 'bg-condition-very-good-bg text-condition-very-good-text border-condition-very-good border-2',
    inactive: 'bg-semantic-bg-elevated text-semantic-text-secondary border border-semantic-border-default',
  },
  good: {
    active: 'bg-condition-good-bg text-condition-good-text border-condition-good border-2',
    inactive: 'bg-semantic-bg-elevated text-semantic-text-secondary border border-semantic-border-default',
  },
  acceptable: {
    active: 'bg-condition-acceptable-bg text-condition-acceptable-text border-condition-acceptable border-2',
    inactive: 'bg-semantic-bg-elevated text-semantic-text-secondary border border-semantic-border-default',
  },
  forParts: {
    active: 'bg-condition-for-parts-bg text-condition-for-parts-text border-condition-for-parts border-2',
    inactive: 'bg-semantic-bg-elevated text-semantic-text-secondary border border-semantic-border-default',
  },
};

const COUNTRY_FLAGS: Record<string, string> = {
  LV: '🇱🇻',
  LT: '🇱🇹',
  EE: '🇪🇪',
};

function BrowseFilters({ currentFilters }: BrowseFiltersProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Local draft state for mobile bottom sheet (apply on submit)
  const [draft, setDraft] = useState<BrowseFiltersType>(currentFilters);

  const activeCount = countActiveFilters(currentFilters);

  const applyFilters = useCallback(
    (filters: BrowseFiltersType) => {
      // Reset to page 1 when filters change
      const url = `/browse${filtersToSearchParams({ ...filters, page: 1 })}`;
      router.push(url);
    },
    [router]
  );

  const handleClearAll = useCallback(() => {
    router.push('/browse');
  }, [router]);

  // --- Desktop inline handlers (apply immediately) ---
  const toggleCondition = useCallback(
    (condition: ListingCondition) => {
      const next = currentFilters.conditions.includes(condition)
        ? currentFilters.conditions.filter((c) => c !== condition)
        : [...currentFilters.conditions, condition];
      applyFilters({ ...currentFilters, conditions: next });
    },
    [currentFilters, applyFilters]
  );

  const toggleCountry = useCallback(
    (country: CountryCode) => {
      const next = currentFilters.countries.includes(country)
        ? currentFilters.countries.filter((c) => c !== country)
        : [...currentFilters.countries, country];
      applyFilters({ ...currentFilters, countries: next });
    },
    [currentFilters, applyFilters]
  );

  const handleSortChange = useCallback(
    (sort: SortOption) => {
      applyFilters({ ...currentFilters, sort });
    },
    [currentFilters, applyFilters]
  );

  // --- Mobile draft handlers ---
  const toggleDraftCondition = (condition: ListingCondition) => {
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.includes(condition)
        ? prev.conditions.filter((c) => c !== condition)
        : [...prev.conditions, condition],
    }));
  };

  const toggleDraftCountry = (country: CountryCode) => {
    setDraft((prev) => ({
      ...prev,
      countries: prev.countries.includes(country)
        ? prev.countries.filter((c) => c !== country)
        : [...prev.countries, country],
    }));
  };

  const openMobileFilters = () => {
    setDraft(currentFilters);
    setMobileOpen(true);
  };

  const applyMobileFilters = () => {
    setMobileOpen(false);
    applyFilters(draft);
  };

  const clearMobileDraft = () => {
    setDraft(DEFAULT_FILTERS);
  };

  // --- Shared filter controls renderer ---
  const renderFilterControls = (
    filters: BrowseFiltersType,
    handlers: {
      onToggleCondition: (c: ListingCondition) => void;
      onToggleCountry: (c: CountryCode) => void;
      onPriceMinChange: (val: string) => void;
      onPriceMaxChange: (val: string) => void;
      onPlayerCountChange: (val: string) => void;
      onSortChange: (s: SortOption) => void;
    },
    isMobile: boolean
  ) => (
    <div className={isMobile ? 'space-y-5' : 'flex flex-wrap items-end gap-4'}>
      {/* Condition chips */}
      <div className={isMobile ? '' : ''}>
        {isMobile && (
          <p className="text-sm font-medium text-semantic-text-primary mb-2">Condition</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {LISTING_CONDITIONS.map((condition) => {
            const badgeKey = conditionToBadgeKey[condition];
            const isActive = filters.conditions.includes(condition);
            const chipStyle = conditionChipClasses[badgeKey];
            return (
              <button
                key={condition}
                type="button"
                onClick={() => handlers.onToggleCondition(condition)}
                className={`inline-flex items-center rounded-2xl px-2.5 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                  isActive ? chipStyle.active : chipStyle.inactive
                }`}
              >
                {conditionConfig[badgeKey].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price range */}
      <div className={isMobile ? '' : 'flex items-end gap-2'}>
        {isMobile && (
          <p className="text-sm font-medium text-semantic-text-primary mb-2">Price range</p>
        )}
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Min €"
            value={filters.priceMinCents !== null ? (filters.priceMinCents / 100).toString() : ''}
            onChange={(e) => handlers.onPriceMinChange(e.target.value)}
            className="w-20 min-h-[36px] rounded-lg border border-semantic-border-default px-2 py-1.5 text-sm text-semantic-text-primary bg-semantic-bg-elevated placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-border-focus"
          />
          <span className="text-semantic-text-muted text-sm">–</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Max €"
            value={filters.priceMaxCents !== null ? (filters.priceMaxCents / 100).toString() : ''}
            onChange={(e) => handlers.onPriceMaxChange(e.target.value)}
            className="w-20 min-h-[36px] rounded-lg border border-semantic-border-default px-2 py-1.5 text-sm text-semantic-text-primary bg-semantic-bg-elevated placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-border-focus"
          />
        </div>
      </div>

      {/* Player count */}
      <div>
        {isMobile && (
          <p className="text-sm font-medium text-semantic-text-primary mb-2">Plays with</p>
        )}
        <div className="flex items-center gap-2">
          {!isMobile && (
            <span className="text-sm text-semantic-text-secondary whitespace-nowrap">Plays with</span>
          )}
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="20"
            placeholder="#"
            value={filters.playerCount !== null ? filters.playerCount.toString() : ''}
            onChange={(e) => handlers.onPlayerCountChange(e.target.value)}
            className="w-14 min-h-[36px] rounded-lg border border-semantic-border-default px-2 py-1.5 text-sm text-semantic-text-primary bg-semantic-bg-elevated placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-border-focus text-center"
          />
          {!isMobile && (
            <span className="text-sm text-semantic-text-muted">players</span>
          )}
        </div>
      </div>

      {/* Country chips */}
      <div>
        {isMobile && (
          <p className="text-sm font-medium text-semantic-text-primary mb-2">Seller country</p>
        )}
        <div className="flex gap-1.5">
          {COUNTRIES.map((country) => {
            const isActive = filters.countries.includes(country.code);
            return (
              <button
                key={country.code}
                type="button"
                onClick={() => handlers.onToggleCountry(country.code)}
                className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                  isActive
                    ? 'bg-frost-ice/10 text-frost-arctic border-2 border-frost-ice'
                    : 'bg-semantic-bg-elevated text-semantic-text-secondary border border-semantic-border-default'
                }`}
              >
                <span>{COUNTRY_FLAGS[country.code]}</span>
                {country.code}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort */}
      <div className={isMobile ? '' : 'ml-auto'}>
        {isMobile && (
          <p className="text-sm font-medium text-semantic-text-primary mb-2">Sort by</p>
        )}
        <select
          value={filters.sort}
          onChange={(e) => handlers.onSortChange(e.target.value as SortOption)}
          className="min-h-[36px] rounded-lg border border-semantic-border-default px-2 py-1.5 text-sm text-semantic-text-primary bg-semantic-bg-elevated focus:outline-none focus:ring-2 focus:ring-semantic-border-focus"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // Desktop price change handlers (apply on blur for better UX)
  const [desktopPriceMin, setDesktopPriceMin] = useState(
    currentFilters.priceMinCents !== null ? (currentFilters.priceMinCents / 100).toString() : ''
  );
  const [desktopPriceMax, setDesktopPriceMax] = useState(
    currentFilters.priceMaxCents !== null ? (currentFilters.priceMaxCents / 100).toString() : ''
  );
  const [desktopPlayers, setDesktopPlayers] = useState(
    currentFilters.playerCount !== null ? currentFilters.playerCount.toString() : ''
  );

  const applyDesktopPriceAndPlayers = useCallback(() => {
    const minCents = desktopPriceMin ? Math.round(parseFloat(desktopPriceMin) * 100) : null;
    const maxCents = desktopPriceMax ? Math.round(parseFloat(desktopPriceMax) * 100) : null;
    const players = desktopPlayers ? parseInt(desktopPlayers, 10) : null;

    const priceMinCents = minCents && minCents > 0 ? minCents : null;
    const priceMaxCents = maxCents && maxCents > 0 ? maxCents : null;
    const playerCount = players && players > 0 ? players : null;

    if (
      priceMinCents !== currentFilters.priceMinCents ||
      priceMaxCents !== currentFilters.priceMaxCents ||
      playerCount !== currentFilters.playerCount
    ) {
      applyFilters({ ...currentFilters, priceMinCents, priceMaxCents, playerCount });
    }
  }, [desktopPriceMin, desktopPriceMax, desktopPlayers, currentFilters, applyFilters]);

  return (
    <>
      {/* Mobile: filter button + sort */}
      <div className="sm:hidden flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={openMobileFilters}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg border border-semantic-border-default bg-semantic-bg-elevated text-sm font-medium text-semantic-text-primary shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          Filters{activeCount > 0 && ` (${activeCount})`}
        </button>
        <select
          value={currentFilters.sort}
          onChange={(e) => handleSortChange(e.target.value as SortOption)}
          className="min-h-[44px] rounded-lg border border-semantic-border-default px-3 py-2.5 text-sm text-semantic-text-primary bg-semantic-bg-elevated focus:outline-none focus:ring-2 focus:ring-semantic-border-focus"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-sm text-semantic-text-muted underline min-h-[44px] px-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Mobile bottom sheet */}
      <Modal
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title="Filter games"
      >
        {renderFilterControls(draft, {
          onToggleCondition: toggleDraftCondition,
          onToggleCountry: toggleDraftCountry,
          onPriceMinChange: (val) => {
            const cents = val ? Math.round(parseFloat(val) * 100) : null;
            setDraft((prev) => ({
              ...prev,
              priceMinCents: cents && cents > 0 ? cents : null,
            }));
          },
          onPriceMaxChange: (val) => {
            const cents = val ? Math.round(parseFloat(val) * 100) : null;
            setDraft((prev) => ({
              ...prev,
              priceMaxCents: cents && cents > 0 ? cents : null,
            }));
          },
          onPlayerCountChange: (val) => {
            const n = val ? parseInt(val, 10) : null;
            setDraft((prev) => ({
              ...prev,
              playerCount: n && n > 0 ? n : null,
            }));
          },
          onSortChange: (sort) => setDraft((prev) => ({ ...prev, sort })),
        }, true)}
        <div className="flex gap-3 mt-6 pt-4 border-t border-semantic-border-subtle">
          <Button variant="secondary" onClick={clearMobileDraft} className="flex-1">
            Clear all
          </Button>
          <Button onClick={applyMobileFilters} className="flex-1">
            Apply filters
          </Button>
        </div>
      </Modal>

      {/* Desktop: inline filter bar */}
      <div className="hidden sm:block mb-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Condition chips */}
          <div className="flex flex-wrap gap-1.5">
            {LISTING_CONDITIONS.map((condition) => {
              const badgeKey = conditionToBadgeKey[condition];
              const isActive = currentFilters.conditions.includes(condition);
              const chipStyle = conditionChipClasses[badgeKey];
              return (
                <button
                  key={condition}
                  type="button"
                  onClick={() => toggleCondition(condition)}
                  className={`inline-flex items-center rounded-2xl px-2.5 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                    isActive ? chipStyle.active : chipStyle.inactive
                  }`}
                >
                  {conditionConfig[badgeKey].label}
                </button>
              );
            })}
          </div>

          {/* Price range */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder="Min €"
              value={desktopPriceMin}
              onChange={(e) => setDesktopPriceMin(e.target.value)}
              onBlur={applyDesktopPriceAndPlayers}
              onKeyDown={(e) => { if (e.key === 'Enter') applyDesktopPriceAndPlayers(); }}
              className="w-20 min-h-[32px] rounded-lg border border-semantic-border-default px-2 py-1 text-sm text-semantic-text-primary bg-semantic-bg-elevated placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-border-focus"
            />
            <span className="text-semantic-text-muted text-sm">–</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="Max €"
              value={desktopPriceMax}
              onChange={(e) => setDesktopPriceMax(e.target.value)}
              onBlur={applyDesktopPriceAndPlayers}
              onKeyDown={(e) => { if (e.key === 'Enter') applyDesktopPriceAndPlayers(); }}
              className="w-20 min-h-[32px] rounded-lg border border-semantic-border-default px-2 py-1 text-sm text-semantic-text-primary bg-semantic-bg-elevated placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-border-focus"
            />
          </div>

          {/* Player count */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-semantic-text-secondary whitespace-nowrap">Plays with</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="20"
              placeholder="#"
              value={desktopPlayers}
              onChange={(e) => setDesktopPlayers(e.target.value)}
              onBlur={applyDesktopPriceAndPlayers}
              onKeyDown={(e) => { if (e.key === 'Enter') applyDesktopPriceAndPlayers(); }}
              className="w-12 min-h-[32px] rounded-lg border border-semantic-border-default px-2 py-1 text-sm text-semantic-text-primary bg-semantic-bg-elevated placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-border-focus text-center"
            />
          </div>

          {/* Country chips */}
          <div className="flex gap-1.5">
            {COUNTRIES.map((country) => {
              const isActive = currentFilters.countries.includes(country.code);
              return (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => toggleCountry(country.code)}
                  className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                    isActive
                      ? 'bg-frost-ice/10 text-frost-arctic border-2 border-frost-ice'
                      : 'bg-semantic-bg-elevated text-semantic-text-secondary border border-semantic-border-default'
                  }`}
                >
                  <span>{COUNTRY_FLAGS[country.code]}</span>
                  {country.code}
                </button>
              );
            })}
          </div>

          {/* Sort + clear */}
          <div className="flex items-center gap-2 ml-auto">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-sm text-semantic-text-muted hover:text-semantic-text-secondary underline"
              >
                Clear filters
              </button>
            )}
            <select
              value={currentFilters.sort}
              onChange={(e) => handleSortChange(e.target.value as SortOption)}
              className="min-h-[32px] rounded-lg border border-semantic-border-default px-2 py-1 text-sm text-semantic-text-primary bg-semantic-bg-elevated focus:outline-none focus:ring-2 focus:ring-semantic-border-focus"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </>
  );
}

export { BrowseFilters };
