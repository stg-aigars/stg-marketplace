'use client';

import { useMemo, useState } from 'react';
import { Alert, Input } from '@/components/ui';
import type { TerminalOption } from '@/lib/services/unisend/types';

interface TerminalPickerProps {
  terminals: TerminalOption[];
  selectedId: string;
  onSelect: (terminal: TerminalOption) => void;
  fetchFailed?: boolean;
}

function TerminalPicker({ terminals, selectedId, onSelect, fetchFailed }: TerminalPickerProps) {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const query = search.toLowerCase();
    const filtered = query
      ? terminals.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            t.city.toLowerCase().includes(query) ||
            t.address.toLowerCase().includes(query)
        )
      : terminals;

    const groups: Record<string, TerminalOption[]> = {};
    for (const t of filtered) {
      if (!groups[t.city]) groups[t.city] = [];
      groups[t.city].push(t);
    }
    return groups;
  }, [terminals, search]);

  const selected = terminals.find((t) => t.id === selectedId);

  return (
    <div>
      <label className="block text-sm font-medium text-semantic-text-secondary mb-1.5">
        Pickup terminal
      </label>
      {fetchFailed && (
        <Alert variant="warning" className="mb-2">
          Pickup terminals could not be loaded. Please try refreshing the page.
        </Alert>
      )}
      <Input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by city or terminal name..."
      />
      <div className="mt-2 max-h-64 sm:max-h-48 overflow-y-auto rounded-lg border border-semantic-border-subtle">
        {Object.keys(grouped).length === 0 ? (
          <p className="p-3 text-sm text-semantic-text-muted">No terminals found</p>
        ) : (
          Object.entries(grouped).map(([city, cityTerminals]) => (
            <div key={city}>
              <div className="px-3 py-1.5 bg-semantic-bg-subtle text-xs font-medium text-semantic-text-muted uppercase tracking-wide sticky top-0">
                {city}
              </div>
              {cityTerminals.map((terminal) => (
                <button
                  key={terminal.id}
                  type="button"
                  onClick={() => onSelect(terminal)}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors min-h-[44px] ${
                    selectedId === terminal.id
                      ? 'bg-semantic-brand/10 text-semantic-brand-active font-medium'
                      : 'text-semantic-text-secondary sm:hover:bg-snow-storm-light'
                  }`}
                >
                  <span className="block">{terminal.name}</span>
                  <span className="block text-xs text-semantic-text-muted">{terminal.address}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
      {selected && (
        <p className="mt-2 text-sm text-semantic-brand-active">
          Selected: {selected.name}
        </p>
      )}
    </div>
  );
}

export { TerminalPicker };
