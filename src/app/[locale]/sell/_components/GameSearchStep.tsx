'use client';

import { useState, useEffect, useRef } from 'react';
import { Input, Card, CardBody, Button, Spinner, Badge, EmptyState } from '@/components/ui';
import { MagnifyingGlass, MagnifyingGlassMinus, PencilSimple } from '@phosphor-icons/react/ssr';
import { GameIdentityRow } from '@/components/listings/atoms';
import { SellStepHeader } from './SellStepHeader';
import { apiFetch } from '@/lib/api-fetch';

interface GameResult {
  id: number;
  name: string;
  yearpublished: number | null;
  thumbnail: string | null;
  player_count: string | null;
  is_expansion?: boolean;
  matched_alternate_name?: string | null;
}

export interface EnrichedGame {
  id: number;
  name: string;
  yearpublished: number | null;
  thumbnail: string | null;
  image: string | null;
  player_count: string | null;
  alternateNames: string[];
  matchedAlternateName?: string | null;
}

/** Build an EnrichedGame from a listing/shelf row with a games join. */
export function buildEnrichedGame(
  bggGameId: number,
  gameName: string,
  gameYear: number | null,
  games: { thumbnail: string | null; image: string | null; player_count: string | null; alternate_names: string[] | null } | null,
): EnrichedGame {
  return {
    id: bggGameId,
    name: gameName,
    yearpublished: gameYear,
    thumbnail: games?.thumbnail ?? null,
    image: games?.image ?? null,
    player_count: games?.player_count ?? null,
    alternateNames: games?.alternate_names ?? [],
    matchedAlternateName: null,
  };
}

interface GameSearchStepProps {
  selectedGameId: number | null;
  selectedGame?: EnrichedGame | null;
  onSelect: (game: EnrichedGame) => void;
  locked?: boolean;
  heading?: string;
}

export function GameSearchStep({ selectedGameId, selectedGame: selectedGameProp, onSelect, locked, heading = 'What game are you selling?' }: GameSearchStepProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GameResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [enriching, setEnriching] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedGame, setSelectedGame] = useState<EnrichedGame | null>(selectedGameProp ?? null);
  const [error, setError] = useState<string | null>(null);
  const [failedGame, setFailedGame] = useState<GameResult | null>(null);
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
          `/api/games/search?q=${encodeURIComponent(query.trim())}&includeExpansions=true`,
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
                if (Object.keys(thumbs).length === 0) return;
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

  // Abort in-flight requests on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      thumbAbortRef.current?.abort();
    };
  }, []);

  const handleSelectGame = async (game: GameResult) => {
    if (enriching !== null) return;

    setEnriching(game.id);
    setError(null);
    setFailedGame(null);
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
          alternateNames: data.game?.alternate_names ?? [],
          matchedAlternateName: game.matched_alternate_name ?? null,
        };
        setSelectedGame(enriched);
        onSelect(enriched);
      } else {
        setError('Failed to load game details.');
        setFailedGame(game);
      }
    } catch {
      setError('Something went wrong. Please check your connection.');
      setFailedGame(game);
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
    const altName = selectedGame.matchedAlternateName;
    const slimMetaParts: string[] = [];
    if (selectedGame.yearpublished) slimMetaParts.push(String(selectedGame.yearpublished));
    if (altName && altName !== selectedGame.name) slimMetaParts.push(`Also known as: ${altName}`);
    const slimMeta = slimMetaParts.join(' · ');

    return (
      <div className="space-y-4">
        <SellStepHeader
          variant="anchor"
          title="Your game"
          helper="You can continue, or pick a different one."
          anchorImage={selectedGame.image ?? selectedGame.thumbnail}
          anchorGameName={selectedGame.name}
        />
        {(slimMeta || !locked) && (
          <Card>
            <CardBody className="py-2.5">
              <div className="flex items-center gap-3">
                <p className="flex-1 min-w-0 truncate text-sm text-semantic-text-muted">
                  {slimMeta}
                </p>
                {!locked && (
                  <button
                    type="button"
                    onClick={handleChange}
                    className="text-semantic-brand shrink-0 p-1"
                    aria-label="Change game"
                  >
                    <PencilSimple size={16} />
                  </button>
                )}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SellStepHeader
        variant="icon"
        title={heading === 'What game are you selling?' ? 'Find your game' : heading}
        helper="Search by the title on the box, in any language. We use BoardGameGeek as the catalog."
        icon={<MagnifyingGlass size={24} weight="duotone" />}
      />

      <Input
        placeholder="Search for a board game..."
        prefix={<MagnifyingGlass size={18} />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {/* Error state with optional retry */}
      {error && (
        <div className="text-sm text-semantic-error text-center py-2 space-y-2">
          <p>{error}</p>
          {failedGame && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSelectGame(failedGame)}
              disabled={enriching !== null}
            >
              Retry
            </Button>
          )}
        </div>
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
        <EmptyState
          icon={MagnifyingGlass}
          title="Search a game to get started"
          description="Title in any language works."
        />
      )}

      {/* No results */}
      {!searching && hasSearched && results.length === 0 && (
        <EmptyState
          icon={MagnifyingGlassMinus}
          title="We couldn't find that"
          description="Try a shorter title or the original-language name."
        />
      )}

      {/* Results */}
      {!searching && results.length > 0 && (
        <div className="space-y-2">
          {results.map((game) => {
            const showAltName =
              game.matched_alternate_name &&
              !game.name.toLowerCase().includes(query.trim().toLowerCase());
            const action =
              enriching === game.id ? (
                <Spinner className="text-semantic-text-muted shrink-0" />
              ) : game.is_expansion ? (
                <Badge variant="default" className="shrink-0 text-xs">Expansion</Badge>
              ) : null;

            return (
              <Card
                key={game.id}
                hoverable
                className="cursor-pointer"
                onClick={() => handleSelectGame(game)}
              >
                <CardBody className="py-3">
                  <GameIdentityRow
                    thumbnail={game.thumbnail}
                    name={game.name}
                    year={game.yearpublished}
                    size="md"
                    action={action}
                  />
                  {showAltName && (
                    <p className="text-xs text-semantic-text-muted truncate mt-1.5 ml-[60px]">
                      Also known as: {game.matched_alternate_name}
                    </p>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
