'use client';

import { useState, useEffect, useRef } from 'react';
import { Input, Card, CardBody, Button } from '@/components/ui';

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

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timeout = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearching(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/games/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.games ?? []);
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
      const res = await fetch(`/api/games/${game.id}/enrich`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
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
          <svg className="h-5 w-5 animate-spin text-semantic-text-muted" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
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
                      <svg className="w-6 h-6 text-semantic-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
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
                    <svg className="h-5 w-5 animate-spin text-semantic-text-muted shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
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
