'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass, Sliders } from '@phosphor-icons/react/ssr';
import { Modal, Button, Input, Select } from '@/components/ui';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, LISTING_CONDITIONS, type ListingCondition } from '@/lib/listings/types';
import { COUNTRIES, type CountryCode } from '@/lib/country-utils';
import {
  type WantedBrowseFilters as WantedBrowseFiltersType,
  type WantedSortOption,
  wantedFiltersToSearchParams,
} from '@/lib/wanted/filters';

interface WantedBrowseFiltersProps {
  currentFilters: WantedBrowseFiltersType;
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'budget_asc', label: 'Budget: low to high' },
  { value: 'budget_desc', label: 'Budget: high to low' },
];

const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({
  value: c.code,
  label: c.name,
}));

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

export function WantedBrowseFilters({ currentFilters }: WantedBrowseFiltersProps) {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);

  // Local filter state (only committed on Apply)
  const [search, setSearch] = useState(currentFilters.search);
  const [minConditions, setMinConditions] = useState<ListingCondition[]>(currentFilters.minConditions);
  const [budgetMin, setBudgetMin] = useState(currentFilters.budgetMinCents ? (currentFilters.budgetMinCents / 100).toString() : '');
  const [budgetMax, setBudgetMax] = useState(currentFilters.budgetMaxCents ? (currentFilters.budgetMaxCents / 100).toString() : '');
  const [countries, setCountries] = useState<CountryCode[]>(currentFilters.countries);
  const [sort, setSort] = useState<WantedSortOption>(currentFilters.sort);

  function toggleCondition(condition: ListingCondition) {
    setMinConditions((prev) =>
      prev.includes(condition)
        ? prev.filter((c) => c !== condition)
        : [...prev, condition]
    );
  }

  function toggleCountry(code: CountryCode) {
    setCountries((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code]
    );
  }

  function applyFilters() {
    const filters: WantedBrowseFiltersType = {
      search: search.trim(),
      minConditions,
      budgetMinCents: budgetMin ? Math.round(parseFloat(budgetMin) * 100) || null : null,
      budgetMaxCents: budgetMax ? Math.round(parseFloat(budgetMax) * 100) || null : null,
      countries,
      sort,
      page: 1,
    };
    router.push(`/wanted${wantedFiltersToSearchParams(filters)}`);
    setShowFilters(false);
  }

  function clearFilters() {
    setSearch('');
    setMinConditions([]);
    setBudgetMin('');
    setBudgetMax('');
    setCountries([]);
    setSort('newest');
    router.push('/wanted');
    setShowFilters(false);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters();
  }

  return (
    <div className="mb-6 space-y-3">
      {/* Search bar + filter button */}
      <div className="flex gap-2">
        <form onSubmit={handleSearchSubmit} className="flex-1">
          <Input
            prefix={<MagnifyingGlass size={18} className="text-semantic-text-muted" />}
            placeholder="Search wanted games"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        <Button variant="secondary" size="sm" onClick={() => setShowFilters(true)}>
          <Sliders size={18} className="mr-1.5" />
          Filters
        </Button>
      </div>

      {/* Filter modal */}
      <Modal open={showFilters} onClose={() => setShowFilters(false)} title="Filter wanted games">
        <div className="space-y-5">
          {/* Condition chips */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">
              Minimum condition
            </p>
            <div className="flex flex-wrap gap-2">
              {LISTING_CONDITIONS.map((c) => {
                const key = conditionToBadgeKey[c];
                const isActive = minConditions.includes(c);
                const classes = conditionChipClasses[key];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCondition(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[36px] ${isActive ? classes.active : classes.inactive}`}
                  >
                    {conditionConfig[key].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Budget range */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Budget min (EUR)"
              type="text"
              inputMode="decimal"
              value={budgetMin}
              onChange={(e) => setBudgetMin(normalizeDecimalInput(e.target.value))}
              placeholder="0.00"
            />
            <Input
              label="Budget max (EUR)"
              type="text"
              inputMode="decimal"
              value={budgetMax}
              onChange={(e) => setBudgetMax(normalizeDecimalInput(e.target.value))}
              placeholder="Any"
            />
          </div>

          {/* Country */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Country</p>
            <div className="flex gap-2">
              {COUNTRY_OPTIONS.map((c) => {
                const isActive = countries.includes(c.value as CountryCode);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleCountry(c.value as CountryCode)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[36px] ${
                      isActive
                        ? 'bg-semantic-primary text-semantic-text-inverse border-2 border-semantic-primary'
                        : 'bg-semantic-bg-elevated text-semantic-text-secondary border border-semantic-border-default'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sort */}
          <Select
            label="Sort by"
            options={SORT_OPTIONS}
            value={sort}
            onChange={(e) => setSort(e.target.value as WantedSortOption)}
          />

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={clearFilters} className="flex-1">
              Clear all
            </Button>
            <Button onClick={applyFilters} className="flex-1">
              Apply filters
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
