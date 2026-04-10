'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlass, Sliders } from '@phosphor-icons/react/ssr';
import { Modal, Button, Input } from '@/components/ui';
import { COUNTRIES, getCountryFlag, type CountryCode } from '@/lib/country-utils';
import {
  type WantedBrowseFilters as WantedBrowseFiltersType,
  wantedFiltersToSearchParams,
} from '@/lib/wanted/filters';

interface WantedBrowseFiltersProps {
  currentFilters: WantedBrowseFiltersType;
}

export function WantedBrowseFilters({ currentFilters }: WantedBrowseFiltersProps) {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);

  // Local filter state (only committed on Apply)
  const [search, setSearch] = useState(currentFilters.search);
  const [countries, setCountries] = useState<CountryCode[]>(currentFilters.countries);

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
      countries,
      sort: 'newest',
      page: 1,
    };
    router.push(`/wanted${wantedFiltersToSearchParams(filters)}`);
    setShowFilters(false);
  }

  function clearFilters() {
    setSearch('');
    setCountries([]);
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
          {/* Buyer country */}
          <div>
            <p className="text-sm font-medium text-semantic-text-primary mb-2">Buyer country</p>
            <div className="flex gap-1.5">
              {COUNTRIES.map((country) => {
                const isActive = countries.includes(country.code);
                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => toggleCountry(country.code)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-250 ease-out-custom min-h-[44px] ${
                      isActive
                        ? 'bg-semantic-brand/10 text-semantic-brand-active border-2 border-semantic-brand'
                        : 'bg-semantic-bg-elevated text-semantic-text-secondary border border-semantic-border-default'
                    }`}
                  >
                    <span className={getCountryFlag(country.code)} aria-hidden="true" />
                    {country.code}
                  </button>
                );
              })}
            </div>
          </div>

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
