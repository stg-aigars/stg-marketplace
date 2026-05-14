'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Input, Card, CardBody, Button, Spinner, Badge, EmptyState } from '@/components/ui';
import { ArrowSquareOut, Baby, CalendarBlank, ImageSquare, MagnifyingGlass, MagnifyingGlassMinus, PencilSimple, Timer, Users } from '@phosphor-icons/react/ssr';
import { SellStepHeader } from './SellStepHeader';
import { apiFetch } from '@/lib/api-fetch';
import { formatPlayingTime } from '@/lib/bgg/utils';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatExpansionCount } from '@/lib/listings/types';
import { SECTION_HEADING_CLASS } from '@/lib/heading-classes';

interface GameResult {
  id: number;
  name: string;
  yearpublished: number | null;
  thumbnail: string | null;
  player_count: string | null;
  min_age?: number | null;
  playing_time?: string | null;
  weight?: number | null;
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
  min_age: number | null;
  playing_time: string | null;
  weight: number | null;
  alternateNames: string[];
  matchedAlternateName?: string | null;
}

/** Build an EnrichedGame from a listing/shelf row with a games join. */
export function buildEnrichedGame(
  bggGameId: number,
  gameName: string,
  gameYear: number | null,
  games: {
    thumbnail: string | null;
    image: string | null;
    player_count: string | null;
    alternate_names: string[] | null;
    min_age?: number | null;
    playing_time?: string | null;
    weight?: number | null;
  } | null,
): EnrichedGame {
  return {
    id: bggGameId,
    name: gameName,
    yearpublished: gameYear,
    thumbnail: games?.thumbnail ?? null,
    image: games?.image ?? null,
    player_count: games?.player_count ?? null,
    min_age: games?.min_age ?? null,
    playing_time: games?.playing_time ?? null,
    weight: games?.weight ?? null,
    alternateNames: games?.alternate_names ?? [],
    matchedAlternateName: null,
  };
}

export interface DuplicateListingNotice {
  id: string;
  game_name: string;
  price_cents: number;
  expansion_count: number;
}

interface GameSearchStepProps {
  selectedGameId: number | null;
  selectedGame?: EnrichedGame | null;
  onSelect: (game: EnrichedGame) => void;
  locked?: boolean;
  heading?: string;
  duplicateListings?: DuplicateListingNotice[];
  locale?: string;
}

export function GameSearchStep({ selectedGameId, selectedGame: selectedGameProp, onSelect, locked, heading = 'Find your game', duplicateListings = [], locale = 'en' }: GameSearchStepProps) {
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
          min_age: data.game?.min_age ?? null,
          playing_time: data.game?.playing_time ?? null,
          weight: data.game?.weight ?? null,
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
    const showAltName = altName && altName !== selectedGame.name;
    const thumbSrc = selectedGame.thumbnail ?? selectedGame.image;

    return (
      <div className="space-y-4">
        <div>
          <h2 className={SECTION_HEADING_CLASS}>
            Your game
          </h2>
          <p className="text-sm text-semantic-text-secondary mt-1">
            You can continue, or pick a different one.
          </p>
        </div>
        <Card>
          <CardBody>
            <div className="flex items-start gap-4">
              {thumbSrc ? (
                <Image
                  src={thumbSrc}
                  alt={selectedGame.name}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-lg object-contain bg-semantic-bg-secondary shrink-0"
                  unoptimized
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-semantic-bg-secondary shrink-0 flex items-center justify-center">
                  <ImageSquare size={28} className="text-semantic-text-muted" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-semantic-text-primary truncate">
                  {selectedGame.name}
                </p>
                <GameMetaRow
                  year={selectedGame.yearpublished}
                  playerCount={selectedGame.player_count}
                  minAge={selectedGame.min_age}
                  playingTime={selectedGame.playing_time}
                />
                {showAltName && (
                  <p className="text-xs text-semantic-text-muted truncate mt-0.5">
                    Also known as: {altName}
                  </p>
                )}
              </div>
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
            {duplicateListings.length > 0 && (
              <div className="mt-3 pt-3 border-t border-semantic-border-subtle space-y-1.5">
                <p className="text-sm font-medium text-semantic-text-primary">
                  {duplicateListings.length === 1
                    ? "You've listed this game before"
                    : `You've listed this game ${duplicateListings.length} times`}
                </p>
                <p className="text-sm text-semantic-text-secondary">
                  If you have another copy, go ahead. Or edit your existing {duplicateListings.length === 1 ? 'listing' : 'listings'} instead.
                </p>
                <div className="space-y-0.5 pt-0.5">
                  {duplicateListings.map((listing) => (
                    <a
                      key={listing.id}
                      href={`/${locale}/listings/${listing.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom"
                    >
                      <span>
                        {listing.game_name} — {formatCentsToCurrency(listing.price_cents)}
                        {listing.expansion_count > 0 && (
                          <span className="text-semantic-text-muted ml-1">· {formatExpansionCount(listing.expansion_count)}</span>
                        )}
                      </span>
                      <ArrowSquareOut size={13} weight="bold" className="shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SellStepHeader
        variant="icon"
        title={heading}
        helper="Search by the title on the box, in any language."
        icon={<MagnifyingGlass size={24} weight="duotone" />}
      />

      <Input
        placeholder="Search for a board game..."
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

            return (
              <Card
                key={game.id}
                hoverable
                className="cursor-pointer"
                onClick={() => handleSelectGame(game)}
              >
                <CardBody className="py-3">
                  <div className="flex items-center gap-3">
                    {game.thumbnail ? (
                      <Image
                        src={game.thumbnail}
                        alt={game.name}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-lg object-contain bg-semantic-bg-secondary shrink-0"
                        unoptimized
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-semantic-bg-secondary shrink-0 flex items-center justify-center">
                        <ImageSquare size={24} className="text-semantic-text-muted" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-semantic-text-primary truncate">
                          {game.name}
                        </p>
                        {game.is_expansion && (
                          <Badge variant="default" className="shrink-0 text-xs">Expansion</Badge>
                        )}
                      </div>
                      <GameMetaRow
                        year={game.yearpublished}
                        playerCount={game.player_count}
                        minAge={game.min_age ?? null}
                        playingTime={game.playing_time ?? null}
                      />
                      {showAltName && (
                        <p className="text-xs text-semantic-text-muted truncate mt-0.5">
                          Also known as: {game.matched_alternate_name}
                        </p>
                      )}
                    </div>
                    {enriching === game.id && (
                      <Spinner className="text-semantic-text-muted shrink-0" />
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GameMetaRow({
  year,
  playerCount,
  minAge,
  playingTime,
}: {
  year: number | null;
  playerCount: string | null;
  minAge: number | null;
  playingTime: string | null;
}) {
  const formattedPlayingTime = formatPlayingTime(playingTime);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-semantic-text-muted mt-0.5">
      {year && (
        <span className="flex items-center gap-1">
          <CalendarBlank size={13} className="shrink-0" />
          {year}
        </span>
      )}
      {playerCount && (
        <span className="flex items-center gap-1">
          <Users size={13} className="shrink-0" />
          {playerCount}
        </span>
      )}
      {minAge != null && minAge > 0 && (
        <span className="flex items-center gap-1">
          <Baby size={13} className="shrink-0" />
          {minAge}+
        </span>
      )}
      {formattedPlayingTime && (
        <span className="flex items-center gap-1">
          <Timer size={13} className="shrink-0" />
          {formattedPlayingTime} min
        </span>
      )}
    </div>
  );
}
