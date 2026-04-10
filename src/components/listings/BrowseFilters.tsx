'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass, Sliders } from '@phosphor-icons/react/ssr';
import { Modal, Button } from '@/components/ui';
import { COUNTRIES, getCountryFlag, type CountryCode } from '@/lib/country-utils';
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

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
];

const PLAYER_COUNTS = [1, 2, 3, 4, 5] as const;

const INACTIVE_CHIP = 'bg-semantic-bg-elevated text-semantic-text-secondary border border-semantic-border-default';
const ACTIVE_CHIP = 'bg-semantic-brand/10 text-semantic-brand-active border-2 border-semantic-brand';

function toggleArrayValue<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

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

  // --- Desktop search state ---
  const [desktopSearch, setDesktopSearch] = useState(currentFilters.search);

  const applyDesktopSearch = useCallback(() => {
    const trimmed = desktopSearch.trim();
    if (trimmed !== currentFilters.search) {
      applyFilters({ ...currentFilters, search: trimmed });
    }
  }, [desktopSearch, currentFilters, applyFilters]);

  // --- Desktop inline handlers (apply immediately) ---
  const togglePlayerCount = useCallback(
    (count: number) => applyFilters({ ...currentFilters, playerCounts: toggleArrayValue(currentFilters.playerCounts, count) }),
    [currentFilters, applyFilters]
  );

  const toggleWeight = useCallback(
    (level: WeightLevel) => applyFilters({ ...currentFilters, weightLevels: toggleArrayValue(currentFilters.weightLevels, level) }),
    [currentFilters, applyFilters]
  );

  const toggleCountry = useCallback(
    (country: CountryCode) => applyFilters({ ...currentFilters, countries: toggleArrayValue(currentFilters.countries, country) }),
    [currentFilters, applyFilters]
  );

  const handleSortChange = useCallback(
    (sort: SortOption) => {
      applyFilters({ ...currentFilters, sort });
    },
    [currentFilters, applyFilters]
  );

  // --- Mobile draft handlers ---
  const toggleDraftPlayerCount = (count: number) =>
    setDraft((prev) => ({ ...prev, playerCounts: toggleArrayValue(prev.playerCounts, count) }));

  const toggleDraftWeight = (level: WeightLevel) =>
    setDraft((prev) => ({ ...prev, weightLevels: toggleArrayValue(prev.weightLevels, level) }));

  const toggleDraftCountry = (country: CountryCode) =>
    setDraft((prev) => ({ ...prev, countries: toggleArrayValue(prev.countries, country) }));

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

  // --- Shared renderers ---
  const renderPlayerCountButtons = (
    playerCounts: number[],
    onToggle: (n: number) => void
  ) => (
    <div className="flex gap-1.5">
      {PLAYER_COUNTS.map((count) => {
        const isActive = playerCounts.includes(count);
        return (
          <button
            key={count}
            type="button"
            onClick={() => onToggle(count)}
            className={`inline-flex items-center justify-center rounded-md w-10 h-10 sm:w-8 sm:h-8 text-xs font-medium transition-colors duration-250 ease-out-custom ${
              isActive ? ACTIVE_CHIP : INACTIVE_CHIP
            }`}
          >
            {count === 5 ? '5+' : count}
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
            className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-250 ease-out-custom min-h-[44px] sm:min-h-[32px] ${
              isActive ? ACTIVE_CHIP : INACTIVE_CHIP
            }`}
          >
            {WEIGHT_LEVEL_LABELS[level]}
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
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-250 ease-out-custom min-h-[44px] sm:min-h-[32px] ${
              isActive ? ACTIVE_CHIP : INACTIVE_CHIP
            }`}
          >
            <span className={getCountryFlag(country.code)} aria-hidden="true" />
            {country.code}
          </button>
        );
      })}
    </div>
  );

  const renderToggle = (
    checked: boolean,
    onChange: (checked: boolean) => void,
    label: string
  ) => (
    <label className="flex items-center gap-2 cursor-pointer min-h-[44px] sm:min-h-[32px]">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-250 ease-out-custom ${
          checked ? 'bg-semantic-brand' : 'bg-semantic-border-default'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-semantic-bg-elevated shadow-sm transform transition-transform duration-250 ease-out-custom mt-0.5 ${
            checked ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="text-xs text-semantic-text-secondary whitespace-nowrap">{label}</span>
    </label>
  );

  const renderSortButtons = (
    currentSort: SortOption,
    onSort: (sort: SortOption) => void
  ) => (
    <div className="flex gap-1">
      {SORT_OPTIONS.map((option) => {
        const isActive = currentSort === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSort(option.value)}
            className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-250 ease-out-custom min-h-[44px] sm:min-h-[32px] ${
              isActive ? ACTIVE_CHIP : INACTIVE_CHIP
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Search bar (always visible) */}
      <div className="mb-4">
        <div className="relative">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-semantic-text-muted pointer-events-none"
          />
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
        {renderSortButtons(currentFilters.sort, handleSortChange)}
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
          {/* Players */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Players</p>
            {renderPlayerCountButtons(draft.playerCounts, toggleDraftPlayerCount)}
          </div>

          {/* Complexity */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Complexity</p>
            {renderWeightChips(draft.weightLevels, toggleDraftWeight)}
          </div>

          {/* Country */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Seller country</p>
            {renderCountryChips(draft.countries, toggleDraftCountry)}
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {renderToggle(
              draft.showExpansions,
              (checked) => setDraft((prev) => ({ ...prev, showExpansions: checked })),
              'Expansions'
            )}
            {renderToggle(
              draft.showAuctions,
              (checked) => setDraft((prev) => ({ ...prev, showAuctions: checked })),
              'Auctions only'
            )}
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

      {/* Desktop: all filters in one row */}
      <div className="hidden sm:block mb-6">
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          {/* Players */}
          <div>
            <p className="text-xs font-medium text-semantic-text-muted mb-1.5">Players</p>
            {renderPlayerCountButtons(currentFilters.playerCounts, togglePlayerCount)}
          </div>

          {/* Complexity */}
          <div>
            <p className="text-xs font-medium text-semantic-text-muted mb-1.5">Complexity</p>
            {renderWeightChips(currentFilters.weightLevels, toggleWeight)}
          </div>

          {/* Country */}
          <div>
            <p className="text-xs font-medium text-semantic-text-muted mb-1.5">Country</p>
            {renderCountryChips(currentFilters.countries, toggleCountry)}
          </div>

          {/* Toggles */}
          <div className="flex items-end gap-4">
            {renderToggle(
              currentFilters.showExpansions,
              (checked) => applyFilters({ ...currentFilters, showExpansions: checked }),
              'Expansions'
            )}
            {renderToggle(
              currentFilters.showAuctions,
              (checked) => applyFilters({ ...currentFilters, showAuctions: checked }),
              'Auctions only'
            )}
          </div>

          {/* Sort + Clear (right-aligned) */}
          <div className="flex items-end gap-3 ml-auto">
            {renderSortButtons(currentFilters.sort, handleSortChange)}

            {activeCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-sm text-semantic-text-muted hover:text-semantic-text-secondary underline min-h-[32px] px-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export { BrowseFilters };
