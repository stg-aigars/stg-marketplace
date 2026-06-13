'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from '@phosphor-icons/react/ssr';
import { Input, Spinner } from '@/components/ui';
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

/** True if `value` already contains a BGG accessory with this id. */
function hasAccessoryId(value: ComponentUpgrade[], id: number): boolean {
  return value.some((u) => u.bgg_accessory_id === id);
}

/** True if `value` already contains an upgrade with this name (case-insensitive, any source). */
function hasName(value: ComponentUpgrade[], name: string): boolean {
  return value.some((u) => u.name.toLowerCase() === name.toLowerCase());
}

/**
 * Lets a seller declare which component upgrades / extras their copy includes.
 * Shows the game's full BGG accessory list as a browsable, filterable checkbox
 * list (the seller can scan it without knowing exact product names) and allows
 * free-text additions for anything not catalogued on BGG.
 */
export function ComponentUpgradesPicker({ gameId, value, onChange }: ComponentUpgradesPickerProps) {
  const [accessories, setAccessories] = useState<BGGAccessory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    // gameId is fixed for the picker's lifetime (set once the game is chosen), so
    // loading starts true from useState and we only need to clear it after the fetch.
    let cancelled = false;
    apiFetch(`/api/games/${gameId}/accessories`)
      .then((res) => (res.ok ? res.json() : { accessories: [] }))
      .then((data) => {
        if (!cancelled) setAccessories(data.accessories ?? []);
      })
      .catch(() => {
        // Non-fatal: the seller can still add free-text upgrades.
        if (!cancelled) setAccessories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const atLimit = value.length >= MAX_COMPONENT_UPGRADES;

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return accessories;
    return accessories.filter((a) => a.name.toLowerCase().includes(q));
  }, [accessories, filter]);

  const toggleAccessory = (accessory: BGGAccessory) => {
    if (hasAccessoryId(value, accessory.id)) {
      onChange(value.filter((u) => u.bgg_accessory_id !== accessory.id));
    } else if (!atLimit && !hasName(value, accessory.name)) {
      onChange([...value, { bgg_accessory_id: accessory.id, name: accessory.name }]);
    }
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name || atLimit || hasName(value, name)) {
      setCustomName('');
      return;
    }
    onChange([...value, { bgg_accessory_id: null, name }]);
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
                onClick={() => removeAt(index)}
                aria-label={`Remove ${upgrade.name}`}
                className="text-semantic-text-muted sm:hover:text-semantic-error transition-colors duration-250 ease-out-custom"
              >
                <X size={14} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-semantic-text-muted py-2">
          <Spinner size="sm" />
          Loading accessories…
        </div>
      ) : (
        accessories.length > 0 && (
          <>
            <Input
              id="component-upgrades-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Filter ${accessories.length} known accessories…`}
              autoComplete="off"
            />
            <div className="max-h-72 overflow-y-auto rounded-lg border border-semantic-border-subtle">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-sm text-semantic-text-muted">
                  No accessories match your filter.
                </p>
              ) : (
                <ul className="divide-y divide-semantic-border-subtle">
                  {filtered.map((accessory) => {
                    const checked = hasAccessoryId(value, accessory.id);
                    // Block selecting new items at the cap, but always allow unchecking.
                    const disabled = !checked && atLimit;
                    return (
                      <li key={accessory.id}>
                        <label
                          className={`flex items-center gap-3 px-3 py-2.5 transition-colors duration-250 ease-out-custom ${
                            disabled
                              ? 'cursor-not-allowed opacity-50'
                              : 'cursor-pointer hover:bg-semantic-bg-subtle'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleAccessory(accessory)}
                            className="h-4 w-4 rounded border-semantic-border-default accent-semantic-brand shrink-0"
                          />
                          <span className="text-sm text-semantic-text-primary">{accessory.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )
      )}

      {!loading && accessories.length === 0 && (
        <p className="text-sm text-semantic-text-muted">
          No accessories are catalogued on BGG for this game — add any extras below.
        </p>
      )}

      {atLimit ? (
        <p className="text-sm text-semantic-text-muted">
          You&apos;ve added the maximum of {MAX_COMPONENT_UPGRADES} extras.
        </p>
      ) : (
        /* Free-text fallback for anything not in BGG's list */
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
          placeholder="e.g. Hand-painted miniatures"
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
      )}
    </div>
  );
}
