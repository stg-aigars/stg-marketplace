'use client';

import { useState, useEffect, useRef } from 'react';
import { Input, Card, CardBody, Button, Spinner } from '@/components/ui';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { apiFetch } from '@/lib/api-fetch';

interface GameResult {
  id: number;
  name: string;
  yearpublished: number | null;
  thumbnail: string | null;
  player_count: string | null;
}

export interface EnrichedGame {
  id: number;
  name: string;
  yearpublished: number | null;
  thumbnail: string | null;
  image: string | null;
  player_count: string | null;
}

interface GameSearchStepProps {
  selectedGameId: number | null;
  selectedGame?: EnrichedGame | null;
  onSelect: (game: EnrichedGame) => void;
}

export function GameSearchStep({ selectedGameId, selectedGame: selectedGameProp, onSelect }: GameSearchStepProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GameResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [enriching, setEnriching] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedGame, setSelectedGame] = useState<EnrichedGame | null>(selectedGameProp ?? null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const thumbAbortRef = useRef<AbortController | null>(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      thumbAbortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearching(true);
      setError(null);
      try {
        const res = await apiFetch(
          `/api/games/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          const games: GameResult[] = data.games ?? [];
          setResults(games);

          // Progressive thumbnail loading for results missing thumbnails
          const missingIds = games
            .filter((g) => !g.thumbnail)
            .map((g) => g.id);

          if (missingIds.length > 0) {
            const thumbController = new AbortController();
            thumbAbortRef.current = thumbController;

            apiFetch('/api/games/thumbnails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: missingIds }),
              signal: thumbController.signal,
            })
              .then((thumbRes) => (thumbRes.ok ? thumbRes.json() : null))
              .then((thumbData) => {
                if (!thumbData?.thumbnails || thumbController.signal.aborted) return;
                const thumbs = thumbData.thumbnails as Record<string, string>;
                setResults((prev) =>
                  prev.map((g) =>
                    thumbs[g.id] ? { ...g, thumbnail: thumbs[g.id] } : g
                  )
                );
              })
              .catch(() => {
                // Silent failure — placeholders remain
              });
          }
        } else {
          setError('Game search is temporarily unavailable. Please try again.');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('Could not reach the server. Please check your connection and try again.');
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
          setHasSearched(true);
        }
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelectGame = async (game: GameResult) => {
    if (enriching !== null) return;

    setEnriching(game.id);
    setError(null);
    try {
      const res = await apiFetch(`/api/games/${game.id}/enrich`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const enriched: EnrichedGame = {
          id: game.id,
          name: data.game?.name ?? game.name,
          yearpublished: data.game?.yearpublished ?? game.yearpublished,
          thumbnail: data.game?.thumbnail ?? game.thumbnail,
          image: data.game?.image ?? null,
          player_count: data.game?.player_count ?? game.player_count,
        };
        setSelectedGame(enriched);
        onSelect(enriched);
      } else {
        setError('Failed to load game details. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setEnriching(null);
    }
  };

  const handleChange = () => {
    setSelectedGame(null);
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setError(null);
  };

  // Show selected game card
  if (selectedGameId && selectedGame) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
          Selected game
        </h2>
        <Card>
          <CardBody>
            <div className="flex items-center gap-4">
              {selectedGame.thumbnail && (
                <img
                  src={selectedGame.thumbnail}
                  alt={selectedGame.name}
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-semantic-text-primary truncate">
                  {selectedGame.name}
                </p>
                <div className="flex items-center gap-3 text-sm text-semantic-text-muted mt-0.5">
                  {selectedGame.yearpublished && (
                    <span>{selectedGame.yearpublished}</span>
                  )}
                  {selectedGame.player_count && (
                    <span>{selectedGame.player_count} players</span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleChange}>
                Change
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
        What game are you selling?
      </h2>

      <Input
        placeholder="Search for a board game..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {/* Error state */}
      {error && (
        <p className="text-sm text-semantic-error text-center py-2">
          {error}
        </p>
      )}

      {/* Loading state */}
      {searching && (
        <div className="flex items-center justify-center py-8">
          <Spinner className="text-semantic-text-muted" />
          <span className="ml-2 text-sm text-semantic-text-muted">Searching...</span>
        </div>
      )}

      {/* Empty state */}
      {!searching && !hasSearched && query.length < 2 && (
        <p className="text-sm text-semantic-text-muted text-center py-8">
          Search for a board game to get started
        </p>
      )}

      {/* No results */}
      {!searching && hasSearched && results.length === 0 && (
        <p className="text-sm text-semantic-text-muted text-center py-8">
          No games found. Try a different search term.
        </p>
      )}

      {/* Results */}
      {!searching && results.length > 0 && (
        <div className="space-y-2">
          {results.map((game) => (
            <Card
              key={game.id}
              hoverable
              className="cursor-pointer"
              onClick={() => handleSelectGame(game)}
            >
              <CardBody className="py-3">
                <div className="flex items-center gap-3">
                  {game.thumbnail ? (
                    <img
                      src={game.thumbnail}
                      alt={game.name}
                      className="w-12 h-12 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-semantic-bg-surface shrink-0 flex items-center justify-center">
                      <ImageSquare size={24} className="text-semantic-text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-semantic-text-primary truncate">
                      {game.name}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-semantic-text-muted">
                      {game.yearpublished && <span>{game.yearpublished}</span>}
                      {game.player_count && <span>{game.player_count} players</span>}
                    </div>
                  </div>
                  {enriching === game.id && (
                    <Spinner className="text-semantic-text-muted shrink-0" />
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
