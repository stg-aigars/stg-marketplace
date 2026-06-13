'use client';

import { useEffect, useMemo, useState } from 'react';
import { MagnifyingGlass, Plus, X } from '@phosphor-icons/react/ssr';
import { Input } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import type { BGGAccessory } from '@/lib/bgg';
import {
  MAX_COMPONENT_UPGRADES,
  MAX_UPGRADE_NAME_LENGTH,
  type ComponentUpgrade,
} from '@/lib/listings/types';

interface ComponentUpgradesPickerProps {
  gameId: number;
  value: ComponentUpgrade[];
  onChange: (next: ComponentUpgrade[]) => void;
}

const MAX_SUGGESTIONS = 8;

/** True if `upgrade` is already in `selected` (by BGG id, or case-insensitive name). */
function isSelected(selected: ComponentUpgrade[], upgrade: ComponentUpgrade): boolean {
  return selected.some((u) =>
    upgrade.bgg_accessory_id !== null
      ? u.bgg_accessory_id === upgrade.bgg_accessory_id
      : u.bgg_accessory_id === null && u.name.toLowerCase() === upgrade.name.toLowerCase()
  );
}

/**
 * Lets a seller declare which component upgrades / extras their copy includes.
 * Searches the game's BGG accessory list (noisy — handled by search, not a wall of
 * checkboxes) and allows free-text additions for anything not in BGG.
 */
export function ComponentUpgradesPicker({ gameId, value, onChange }: ComponentUpgradesPickerProps) {
  const [accessories, setAccessories] = useState<BGGAccessory[]>([]);
  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/games/${gameId}/accessories`)
      .then((res) => (res.ok ? res.json() : { accessories: [] }))
      .then((data) => {
        if (!cancelled) setAccessories(data.accessories ?? []);
      })
      .catch(() => {
        // Non-fatal: the seller can still add free-text upgrades.
        if (!cancelled) setAccessories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const atLimit = value.length >= MAX_COMPONENT_UPGRADES;

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return accessories
      .filter((a) => a.name.toLowerCase().includes(q))
      .filter((a) => !isSelected(value, { bgg_accessory_id: a.id, name: a.name }))
      .slice(0, MAX_SUGGESTIONS);
  }, [accessories, search, value]);

  const add = (upgrade: ComponentUpgrade) => {
    if (atLimit || isSelected(value, upgrade)) return;
    onChange([...value, upgrade]);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    add({ bgg_accessory_id: null, name });
    setCustomName('');
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
          Included extras
        </p>
        <p className="text-sm text-semantic-text-secondary mt-1">
          Note any component upgrades or extras your copy includes — metal coins, custom
          inserts, upgraded tokens, sleeves.
        </p>
      </div>

      {/* Selected chips */}
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((upgrade, index) => (
            <li
              key={upgrade.bgg_accessory_id ?? `custom-${upgrade.name}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-semantic-border-default bg-semantic-bg-secondary px-2.5 py-1 text-sm text-semantic-text-primary"
            >
              {upgrade.name}
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove ${upgrade.name}`}
                className="text-semantic-text-muted sm:hover:text-semantic-error transition-colors duration-250 ease-out-custom"
              >
                <X size={14} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {atLimit ? (
        <p className="text-sm text-semantic-text-muted">
          You&apos;ve added the maximum of {MAX_COMPONENT_UPGRADES} extras.
        </p>
      ) : (
        <>
          {/* Search BGG accessories */}
          <div>
            <Input
              id="component-upgrades-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search this game's known accessories…"
              prefix={<MagnifyingGlass size={16} />}
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className="mt-1.5 rounded-md border border-semantic-border-default divide-y divide-semantic-border-subtle overflow-hidden">
                {suggestions.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        add({ bgg_accessory_id: a.id, name: a.name });
                        setSearch('');
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-semantic-text-primary sm:hover:bg-semantic-bg-secondary transition-colors duration-250 ease-out-custom flex items-center gap-2"
                    >
                      <Plus size={14} className="shrink-0 text-semantic-brand" />
                      {a.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Free-text fallback */}
          <Input
            id="component-upgrades-custom"
            label="Not listed? Add your own"
            value={customName}
            onChange={(e) => {
              if (e.target.value.length <= MAX_UPGRADE_NAME_LENGTH) setCustomName(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="e.g. Folded Space insert"
            suffix={
              <button
                type="button"
                onClick={addCustom}
                disabled={!customName.trim()}
                aria-label="Add extra"
                className="text-semantic-brand disabled:text-semantic-text-muted disabled:cursor-not-allowed transition-colors duration-250 ease-out-custom"
              >
                <Plus size={18} weight="bold" />
              </button>
            }
          />
        </>
      )}
    </div>
  );
}
