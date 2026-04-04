'use client';

import { useState, useEffect, useRef } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react/ssr';
import { GameThumb } from '@/components/listings/atoms';
import { Modal, Button, Input, Select, Spinner, Textarea } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { addToShelf } from '@/lib/shelves/actions';
import type { ShelfItemWithGame, ShelfVisibility } from '@/lib/shelves/types';
import { MAX_NOTE_LENGTH, SHELF_VISIBILITY_OPTIONS } from '@/lib/shelves/types';

interface GameResult {
  id: number;
  name: string;
  yearpublished: number | null;
  thumbnail: string | null;
}

interface AddToShelfModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: (item: ShelfItemWithGame) => void;
}

export function AddToShelfModal({ open, onClose, onAdded }: AddToShelfModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GameResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GameResult | null>(null);
  const [visibility, setVisibility] = useState<ShelfVisibility>('not_for_sale');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearching(true);
      try {
        const res = await apiFetch(`/api/games/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          const data = await res.json();
          setResults(data.games ?? []);
        }
      } catch {
        // Aborted or network error — ignore
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [query]);

  // Reset state and abort in-flight requests when modal closes
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setQuery('');
      setResults([]);
      setSelected(null);
      setVisibility('not_for_sale');
      setNotes('');
      setError('');
      setSaving(false);
    }
  }, [open]);

  async function handleSubmit() {
    if (!selected) return;

    setSaving(true);
    setError('');

    const result = await addToShelf(
      selected.id,
      selected.name,
      selected.yearpublished,
      visibility,
      notes || undefined
    );

    if ('error' in result) {
      setError(result.error);
      setSaving(false);
      return;
    }

    const newItem: ShelfItemWithGame = {
      id: result.id,
      seller_id: '',
      bgg_game_id: selected.id,
      game_name: selected.name,
      game_year: selected.yearpublished,
      visibility,
      notes: notes.trim() || null,
      listing_id: null,
      thumbnail: selected.thumbnail,
      image: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onAdded(newItem);
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add game to shelf">
      <div className="space-y-4 pb-4">
        {!selected ? (
          <>
            <div className="relative">
              <MagnifyingGlass
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-semantic-text-muted pointer-events-none"
              />
              <Input
                placeholder="Search for a game..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {searching && (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            )}

            {!searching && results.length > 0 && (
              <ul className="max-h-64 overflow-y-auto divide-y divide-semantic-border-subtle rounded-lg border border-semantic-border-subtle">
                {results.map((game) => (
                  <li key={game.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(game)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-semantic-bg-surface transition-colors duration-250 ease-out-custom"
                    >
                      <GameThumb src={game.thumbnail} alt={game.name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-semantic-text-primary truncate">
                          {game.name}
                        </p>
                        {game.yearpublished && (
                          <p className="text-xs text-semantic-text-muted">
                            {game.yearpublished}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!searching && query.length >= 2 && results.length === 0 && (
              <p className="text-sm text-semantic-text-muted text-center py-4">
                No games found
              </p>
            )}
          </>
        ) : (
          <>
            {/* Selected game display */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-semantic-bg-surface border border-semantic-border-subtle">
              <GameThumb src={selected.thumbnail} alt={selected.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-semantic-text-heading truncate">
                  {selected.name}
                </p>
                {selected.yearpublished && (
                  <p className="text-xs text-semantic-text-muted">{selected.yearpublished}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelected(null);
                  setQuery('');
                  setResults([]);
                }}
              >
                Change
              </Button>
            </div>

            <Select
              label="Visibility"
              options={SHELF_VISIBILITY_OPTIONS}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as ShelfVisibility)}
            />

            <div>
              <Textarea
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={MAX_NOTE_LENGTH}
                rows={3}
                placeholder="Condition details, language, edition..."
              />
              <p className="mt-1 text-xs text-semantic-text-muted text-right">
                {notes.length}/{MAX_NOTE_LENGTH}
              </p>
            </div>

            {error && (
              <p className="text-sm text-semantic-error">{error}</p>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Adding...' : 'Add to shelf'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
