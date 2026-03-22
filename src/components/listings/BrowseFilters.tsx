'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sliders } from '@phosphor-icons/react';
import { Modal, Button, Input, Select } from '@/components/ui';
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
  const [draft, setDraft] = useState<BrowseFiltersType>(currentFilters);

  const activeCount = countActiveFilters(currentFilters);

  const applyFilters = useCallback(
    (filters: BrowseFiltersType) => {
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

  // Desktop price/player state (apply on blur)
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

  // --- Shared chip renderer (condition and country chips are custom toggle UI, not action buttons) ---
  const renderConditionChips = (
    conditions: ListingCondition[],
    onToggle: (c: ListingCondition) => void
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {LISTING_CONDITIONS.map((condition) => {
        const badgeKey = conditionToBadgeKey[condition];
        const isActive = conditions.includes(condition);
        const chipStyle = conditionChipClasses[badgeKey];
        return (
          <button
            key={condition}
            type="button"
            onClick={() => onToggle(condition)}
            className={`inline-flex items-center rounded-2xl px-2.5 py-1.5 text-xs font-medium transition-colors min-h-[44px] sm:min-h-[32px] ${
              isActive ? chipStyle.active : chipStyle.inactive
            }`}
          >
            {conditionConfig[badgeKey].label}
          </button>
        );
      })}
    </div>
  );

  const renderCountryChips = (
    countries: CountryCode[],
    onToggle: (c: CountryCode) => void
  ) => (
    <div className="flex gap-1.5">
      {COUNTRIES.map((country) => {
        const isActive = countries.includes(country.code);
        return (
          <button
            key={country.code}
            type="button"
            onClick={() => onToggle(country.code)}
            className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors min-h-[44px] sm:min-h-[32px] ${
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
  );

  return (
    <>
      {/* Mobile: filter button + sort */}
      <div className="sm:hidden flex items-center gap-2 mb-4">
        <Button variant="secondary" onClick={openMobileFilters}>
          <span className="inline-flex items-center gap-2">
            <Sliders size={16} />
            Filters{activeCount > 0 && ` (${activeCount})`}
          </span>
        </Button>
        <div className="w-40">
          <Select
            options={SORT_OPTIONS}
            value={currentFilters.sort}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
          />
        </div>
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
        <div className="space-y-5">
          {/* Condition */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Condition</p>
            {renderConditionChips(draft.conditions, toggleDraftCondition)}
          </div>

          {/* Price range */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Price range</p>
            <div className="flex items-center gap-2">
              <div className="w-24">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Min €"
                  value={draft.priceMinCents !== null ? (draft.priceMinCents / 100).toString() : ''}
                  onChange={(e) => {
                    const cents = e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null;
                    setDraft((prev) => ({ ...prev, priceMinCents: cents && cents > 0 ? cents : null }));
                  }}
                />
              </div>
              <span className="text-semantic-text-muted text-sm">–</span>
              <div className="w-24">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="Max €"
                  value={draft.priceMaxCents !== null ? (draft.priceMaxCents / 100).toString() : ''}
                  onChange={(e) => {
                    const cents = e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null;
                    setDraft((prev) => ({ ...prev, priceMaxCents: cents && cents > 0 ? cents : null }));
                  }}
                />
              </div>
            </div>
          </div>

          {/* Player count */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Plays with</p>
            <div className="w-20">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                placeholder="#"
                value={draft.playerCount !== null ? draft.playerCount.toString() : ''}
                onChange={(e) => {
                  const n = e.target.value ? parseInt(e.target.value, 10) : null;
                  setDraft((prev) => ({ ...prev, playerCount: n && n > 0 ? n : null }));
                }}
                className="text-center"
              />
            </div>
          </div>

          {/* Country */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Seller country</p>
            {renderCountryChips(draft.countries, toggleDraftCountry)}
          </div>

          {/* Sort */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Sort by</p>
            <Select
              options={SORT_OPTIONS}
              value={draft.sort}
              onChange={(e) => setDraft((prev) => ({ ...prev, sort: e.target.value as SortOption }))}
            />
          </div>
        </div>
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
          {renderConditionChips(currentFilters.conditions, toggleCondition)}

          {/* Price range */}
          <div className="flex items-center gap-2">
            <div className="w-20">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Min €"
                value={desktopPriceMin}
                onChange={(e) => setDesktopPriceMin(e.target.value)}
                onBlur={applyDesktopPriceAndPlayers}
                onKeyDown={(e) => { if (e.key === 'Enter') applyDesktopPriceAndPlayers(); }}
              />
            </div>
            <span className="text-semantic-text-muted text-sm">–</span>
            <div className="w-20">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Max €"
                value={desktopPriceMax}
                onChange={(e) => setDesktopPriceMax(e.target.value)}
                onBlur={applyDesktopPriceAndPlayers}
                onKeyDown={(e) => { if (e.key === 'Enter') applyDesktopPriceAndPlayers(); }}
              />
            </div>
          </div>

          {/* Player count */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-semantic-text-secondary whitespace-nowrap">Plays with</span>
            <div className="w-14">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                placeholder="#"
                value={desktopPlayers}
                onChange={(e) => setDesktopPlayers(e.target.value)}
                onBlur={applyDesktopPriceAndPlayers}
                onKeyDown={(e) => { if (e.key === 'Enter') applyDesktopPriceAndPlayers(); }}
                className="text-center"
              />
            </div>
          </div>

          {/* Country chips */}
          {renderCountryChips(currentFilters.countries, toggleCountry)}

          {/* Sort + clear */}
          <div className="flex items-center gap-2 ml-auto">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-sm text-semantic-text-muted hover:text-semantic-text-secondary underline min-h-[44px] px-1"
              >
                Clear filters
              </button>
            )}
            <div className="w-40">
              <Select
                options={SORT_OPTIONS}
                value={currentFilters.sort}
                onChange={(e) => handleSortChange(e.target.value as SortOption)}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export { BrowseFilters };
