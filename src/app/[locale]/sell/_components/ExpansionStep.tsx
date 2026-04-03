'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { X, Package } from '@phosphor-icons/react/ssr';
import { Input, Card, CardBody, Button } from '@/components/ui';

interface ExpansionStepProps {
  expansions: Array<{ id: number; name: string; year?: number; thumbnail?: string | null }>;
  selectedExpansionIds: number[];
  onSelectionChange: (ids: number[]) => void;
}

function ExpansionStep({ expansions, selectedExpansionIds, onSelectionChange }: ExpansionStepProps) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter.trim()) return expansions;
    const query = filter.trim().toLowerCase();
    return expansions.filter((e) => e.name.toLowerCase().includes(query));
  }, [expansions, filter]);

  function handleToggle(id: number) {
    if (selectedExpansionIds.includes(id)) {
      onSelectionChange(selectedExpansionIds.filter((eid) => eid !== id));
    } else {
      onSelectionChange([...selectedExpansionIds, id]);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
        Select included expansions
      </h2>

      {/* Selected expansion cards */}
      {selectedExpansionIds.length > 0 && (
        <div className="space-y-2">
          {selectedExpansionIds.map((id) => {
            const expansion = expansions.find((e) => e.id === id);
            if (!expansion) return null;
            return (
              <Card key={id}>
                <CardBody>
                  <div className="flex items-center gap-4">
                    {expansion.thumbnail ? (
                      <Image
                        src={expansion.thumbnail}
                        alt={expansion.name}
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-lg object-contain bg-semantic-bg-secondary shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-semantic-bg-secondary shrink-0 flex items-center justify-center">
                        <Package size={24} className="text-semantic-text-muted" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-semantic-text-primary truncate">
                        {expansion.name}
                      </p>
                      {expansion.year != null && (
                        <p className="text-sm text-semantic-text-muted">{expansion.year}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectionChange(selectedExpansionIds.filter((eid) => eid !== id))}
                      aria-label={`Remove ${expansion.name}`}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Input
        placeholder="Filter expansions..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <div className="max-h-72 overflow-y-auto rounded-lg border border-semantic-border-subtle">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm text-semantic-text-muted">No expansions match your filter.</p>
        ) : (
          <ul className="divide-y divide-semantic-border-subtle">
            {filtered.map((expansion) => (
              <li key={expansion.id}>
                <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-250 ease-out-custom hover:bg-semantic-bg-subtle">
                  <input
                    type="checkbox"
                    checked={selectedExpansionIds.includes(expansion.id)}
                    onChange={() => handleToggle(expansion.id)}
                    className="h-4 w-4 rounded border-semantic-border-default accent-semantic-brand shrink-0"
                  />
                  <span className="text-sm text-semantic-text-primary">
                    {expansion.name}
                    {expansion.year != null && (
                      <span className="text-semantic-text-muted"> ({expansion.year})</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export { ExpansionStep };
export type { ExpansionStepProps };
