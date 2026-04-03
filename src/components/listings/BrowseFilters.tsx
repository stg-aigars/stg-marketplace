'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass, Sliders } from '@phosphor-icons/react/ssr';
import { Modal, Button, Input, Select } from '@/components/ui';
import { FilterMultiSelect } from './FilterMultiSelect';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, LISTING_CONDITIONS, type ListingCondition } from '@/lib/listings/types';
import { COUNTRIES, type CountryCode } from '@/lib/country-utils';
import {
  type BrowseFilters as BrowseFiltersType,
  type SortOption,
  type WeightLevel,
  filtersToSearchParams,
  countActiveFilters,
  DEFAULT_FILTERS,
  WEIGHT_LEVELS,
  WEIGHT_LEVEL_LABELS,
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

const INACTIVE_CHIP = 'bg-semantic-bg-elevated text-semantic-text-secondary border border-semantic-border-default';
const ACTIVE_WEIGHT_CHIP = 'bg-semantic-brand/10 text-semantic-brand-active border-2 border-semantic-brand';

function BrowseFilters({ currentFilters }: BrowseFiltersProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [draft, setDraft] = useState<BrowseFiltersType>(currentFilters);

  // Filter options from API (categories/mechanics)
  const [filterOptions, setFilterOptions] = useState<{ categories: string[]; mechanics: string[] }>({
    categories: [],
    mechanics: [],
  });
  const filterOptionsFetched = useRef(false);

  useEffect(() => {
    if (filterOptionsFetched.current) return;
    filterOptionsFetched.current = true;
    fetch('/api/filters/options')
      .then((r) => r.json())
      .then((data) => setFilterOptions(data))
      .catch(() => {});
  }, []);

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

  // --- Desktop search state ---
  const [desktopSearch, setDesktopSearch] = useState(currentFilters.search);

  const applyDesktopSearch = useCallback(() => {
    const trimmed = desktopSearch.trim();
    if (trimmed !== currentFilters.search) {
      applyFilters({ ...currentFilters, search: trimmed });
    }
  }, [desktopSearch, currentFilters, applyFilters]);

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

  const toggleWeight = useCallback(
    (level: WeightLevel) => {
      const next = currentFilters.weightLevels.includes(level)
        ? currentFilters.weightLevels.filter((w) => w !== level)
        : [...currentFilters.weightLevels, level];
      applyFilters({ ...currentFilters, weightLevels: next });
    },
    [currentFilters, applyFilters]
  );

  const handleCategoriesChange = useCallback(
    (categories: string[]) => {
      applyFilters({ ...currentFilters, categories });
    },
    [currentFilters, applyFilters]
  );

  const handleMechanicsChange = useCallback(
    (mechanics: string[]) => {
      applyFilters({ ...currentFilters, mechanics });
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

  const toggleDraftWeight = (level: WeightLevel) => {
    setDraft((prev) => ({
      ...prev,
      weightLevels: prev.weightLevels.includes(level)
        ? prev.weightLevels.filter((w) => w !== level)
        : [...prev.weightLevels, level],
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

  // --- Shared chip renderers ---
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
            className={`inline-flex items-center rounded-2xl px-2.5 py-1.5 text-xs font-medium transition-colors duration-250 ease-out-custom min-h-[44px] sm:min-h-[32px] ${
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
            className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors duration-250 ease-out-custom min-h-[44px] sm:min-h-[32px] ${
              isActive
                ? ACTIVE_WEIGHT_CHIP
                : INACTIVE_CHIP
            }`}
          >
            <span>{COUNTRY_FLAGS[country.code]}</span>
            {country.code}
          </button>
        );
      })}
    </div>
  );

  const renderWeightChips = (
    weightLevels: WeightLevel[],
    onToggle: (w: WeightLevel) => void
  ) => (
    <div className="flex flex-wrap gap-1.5">
      {WEIGHT_LEVELS.map((level) => {
        const isActive = weightLevels.includes(level);
        return (
          <button
            key={level}
            type="button"
            onClick={() => onToggle(level)}
            className={`inline-flex items-center rounded-2xl px-2.5 py-1.5 text-xs font-medium transition-colors duration-250 ease-out-custom min-h-[44px] sm:min-h-[32px] ${
              isActive ? ACTIVE_WEIGHT_CHIP : INACTIVE_CHIP
            }`}
          >
            {WEIGHT_LEVEL_LABELS[level]}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Search bar (always visible on both mobile and desktop) */}
      <div className="mb-4">
        <div className="relative">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-semantic-text-muted pointer-events-none"
          />
          {/* Mobile: update draft search and apply on Enter */}
          <input
            type="text"
            placeholder="Search by game name..."
            defaultValue={currentFilters.search}
            onChange={(e) => setDesktopSearch(e.target.value)}
            onBlur={applyDesktopSearch}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyDesktopSearch();
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-semantic-border-default bg-semantic-bg-elevated text-semantic-text-primary placeholder:text-semantic-text-muted focus:outline-none focus:border-semantic-border-focus text-sm"
          />
        </div>
      </div>

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

          {/* Weight */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Complexity</p>
            {renderWeightChips(draft.weightLevels, toggleDraftWeight)}
          </div>

          {/* Price range */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Price range</p>
            <div className="flex items-center gap-2">
              <div className="w-24">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Min €"
                  value={draft.priceMinCents !== null ? (draft.priceMinCents / 100).toString() : ''}
                  onChange={(e) => {
                    const normalized = normalizeDecimalInput(e.target.value);
                    const cents = normalized ? Math.round(parseFloat(normalized) * 100) : null;
                    setDraft((prev) => ({ ...prev, priceMinCents: cents && cents > 0 ? cents : null }));
                  }}
                />
              </div>
              <span className="text-semantic-text-muted text-sm">–</span>
              <div className="w-24">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Max €"
                  value={draft.priceMaxCents !== null ? (draft.priceMaxCents / 100).toString() : ''}
                  onChange={(e) => {
                    const normalized = normalizeDecimalInput(e.target.value);
                    const cents = normalized ? Math.round(parseFloat(normalized) * 100) : null;
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

          {/* Categories */}
          {filterOptions.categories.length > 0 && (
            <div>
              <p className="text-sm font-medium text-semantic-text-primary mb-2">
                Categories{draft.categories.length > 0 && ` (${draft.categories.length})`}
              </p>
              <FilterMultiSelect
                label="Categories"
                options={filterOptions.categories}
                selected={draft.categories}
                onChange={(categories) => setDraft((prev) => ({ ...prev, categories }))}
                inline
              />
            </div>
          )}

          {/* Mechanics */}
          {filterOptions.mechanics.length > 0 && (
            <div>
              <p className="text-sm font-medium text-semantic-text-primary mb-2">
                Mechanics{draft.mechanics.length > 0 && ` (${draft.mechanics.length})`}
              </p>
              <FilterMultiSelect
                label="Mechanics"
                options={filterOptions.mechanics}
                selected={draft.mechanics}
                onChange={(mechanics) => setDraft((prev) => ({ ...prev, mechanics }))}
                inline
              />
            </div>
          )}

          {/* Sort */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Sort by</p>
            <Select
              options={SORT_OPTIONS}
              value={draft.sort}
              onChange={(e) => setDraft((prev) => ({ ...prev, sort: e.target.value as SortOption }))}
            />
          </div>

          {/* Show expansion listings */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.showExpansions}
              onChange={(e) => setDraft((prev) => ({ ...prev, showExpansions: e.target.checked }))}
              className="h-4 w-4 rounded border-semantic-border-default accent-semantic-brand"
            />
            <span className="text-sm text-semantic-text-secondary">Show expansion listings</span>
          </label>
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
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          {/* Condition chips */}
          {renderConditionChips(currentFilters.conditions, toggleCondition)}

          {/* Weight chips */}
          {renderWeightChips(currentFilters.weightLevels, toggleWeight)}

          {/* Price range */}
          <div className="flex items-center gap-2">
            <div className="w-20">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Min €"
                value={desktopPriceMin}
                onChange={(e) => setDesktopPriceMin(normalizeDecimalInput(e.target.value))}
                onBlur={applyDesktopPriceAndPlayers}
                onKeyDown={(e) => { if (e.key === 'Enter') applyDesktopPriceAndPlayers(); }}
              />
            </div>
            <span className="text-semantic-text-muted text-sm">–</span>
            <div className="w-20">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Max €"
                value={desktopPriceMax}
                onChange={(e) => setDesktopPriceMax(normalizeDecimalInput(e.target.value))}
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

          {/* Categories dropdown */}
          {filterOptions.categories.length > 0 && (
            <FilterMultiSelect
              label="Categories"
              options={filterOptions.categories}
              selected={currentFilters.categories}
              onChange={handleCategoriesChange}
            />
          )}

          {/* Mechanics dropdown */}
          {filterOptions.mechanics.length > 0 && (
            <FilterMultiSelect
              label="Mechanics"
              options={filterOptions.mechanics}
              selected={currentFilters.mechanics}
              onChange={handleMechanicsChange}
            />
          )}

          {/* Show expansion listings */}
          <label className="flex items-center gap-1.5 cursor-pointer min-h-[44px] sm:min-h-[32px]">
            <input
              type="checkbox"
              checked={currentFilters.showExpansions}
              onChange={(e) => applyFilters({ ...currentFilters, showExpansions: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-semantic-border-default accent-semantic-brand"
            />
            <span className="text-xs text-semantic-text-secondary whitespace-nowrap">Expansions</span>
          </label>

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
