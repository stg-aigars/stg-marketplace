'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Stepper, TurnstileWidget, Alert, Card, CardBody, Spinner } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { createListing } from '@/lib/listings/actions';
import type { ListingCondition, ListingType, VersionSource, ListingExpansion } from '@/lib/listings/types';
import { conditionRequiresPhotos, conditionRequiresDescription, formatExpansionCount } from '@/lib/listings/types';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { apiFetch } from '@/lib/api-fetch';
import { useAuth } from '@/contexts/AuthContext';
import { GameSearchStep, buildEnrichedGame } from './GameSearchStep';
import type { EnrichedGame } from './GameSearchStep';
import { VersionStep } from './VersionStep';
import { ConditionPhotosStep } from './ConditionPhotosStep';
import { ReviewPriceStep } from './ReviewPriceStep';
import { ExpansionStep } from './ExpansionStep';
import type { VersionData } from '@/lib/listings/types';
import type { BGGVersion } from '@/lib/bgg/types';

interface GameExpansion {
  id: number;
  name: string;
  year?: number;
  thumbnail?: string | null;
}

interface DuplicateListing {
  id: string;
  game_name: string;
  price_cents: number;
  condition: string;
  listing_type: string;
  expansion_count: number;
}

export interface FormData {
  // Step 1: Game
  bgg_game_id: number | null;
  game_name: string;
  game_year: number | null;
  game_thumbnail: string | null;
  game_image: string | null;
  game_player_count: string | null;
  is_expansion: boolean;
  // Expansion step
  selected_expansion_ids: number[];
  // Step: Version (base game)
  version_source: VersionSource | null;
  bgg_version_id: number | null;
  version_name: string | null;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
  version_thumbnail: string | null;
  // Step: Version (expansions) — keyed by bgg_game_id
  expansion_versions: Record<number, VersionData>;
  expansion_game_names: Record<number, string>;
  // Step: Condition, photos & description
  photos: string[];
  condition: ListingCondition | null;
  description: string;
  // Step: Price (set on review step)
  price_cents: number;
  // Auction fields
  starting_price_cents: number;
  auction_duration_days: number;
}

const initialFormData: FormData = {
  bgg_game_id: null,
  game_name: '',
  game_year: null,
  game_thumbnail: null,
  game_image: null,
  game_player_count: null,
  is_expansion: false,
  selected_expansion_ids: [],
  version_source: null,
  bgg_version_id: null,
  version_name: null,
  publisher: null,
  language: null,
  edition_year: null,
  version_thumbnail: null,
  expansion_versions: {},
  expansion_game_names: {},
  photos: [],
  condition: null,
  price_cents: 0,
  description: '',
  starting_price_cents: 0,
  auction_duration_days: 3,
};

type StepId = 'game' | 'edition' | 'details' | 'review';

interface ListingCreationFlowProps {
  initialData?: Partial<FormData>;
  initialGame?: EnrichedGame | null;
  lockedFields?: ('game' | 'price')[];
  offerId?: string;
  listingType?: ListingType;
}

export function ListingCreationFlow({
  initialData,
  initialGame,
  lockedFields = [],
  offerId,
  listingType = 'fixed_price',
}: ListingCreationFlowProps = {}) {
  const isAuction = listingType === 'auction';
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const { profile } = useAuth();
  const userCountry = profile?.country ?? null;
  const gameLocked = lockedFields.includes('game');
  const priceLocked = lockedFields.includes('price');

  const [formData, setFormData] = useState<FormData>(() =>
    initialData ? { ...initialFormData, ...initialData } : initialFormData
  );
  const [selectedGame, setSelectedGame] = useState<EnrichedGame | null>(initialGame ?? null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  // Expansion discovery state
  const [availableExpansions, setAvailableExpansions] = useState<GameExpansion[]>([]);
  const [loadingExpansions, setLoadingExpansions] = useState(false);
  const [expansionGateAnswer, setExpansionGateAnswer] = useState<boolean | null>(null);
  const [duplicateListings, setDuplicateListings] = useState<DuplicateListing[]>([]);
  const [enrichedExpansions, setEnrichedExpansions] = useState<Record<number, EnrichedGame>>({});
  // Version cache: avoids re-fetching BGG versions on back/forward navigation
  const [versionCache, setVersionCache] = useState<Record<number, BGGVersion[]>>({});
  const handleVersionsFetched = useCallback((gameId: number, versions: BGGVersion[]) => {
    setVersionCache((prev) => ({ ...prev, [gameId]: versions }));
  }, []);

  const STEPS: { id: StepId; label: string }[] = [
    { id: 'game', label: 'Game' },
    { id: 'edition', label: 'Edition' },
    { id: 'details', label: 'Details' },
    { id: 'review', label: 'Review' },
  ];

  const steps = gameLocked ? STEPS.filter((s) => s.id !== 'game') : STEPS;

  // Track current step by ID for robustness against dynamic step changes
  const [currentStepId, setCurrentStepId] = useState<StepId>(gameLocked ? 'edition' : 'game');

  const currentStepIndex = steps.findIndex((s) => s.id === currentStepId);
  const totalSteps = steps.length;

  const updateFormData = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Fetch expansions and check duplicates after game selection
  useEffect(() => {
    if (!formData.bgg_game_id || formData.is_expansion) {
      setAvailableExpansions([]);
      setDuplicateListings([]);
      return;
    }

    let cancelled = false;

    // Fetch available expansions
    setLoadingExpansions(true);
    apiFetch(`/api/games/${formData.bgg_game_id}/expansions`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data) {
          setAvailableExpansions(data.expansions ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setAvailableExpansions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingExpansions(false);
      });

    // Check for duplicate listings (non-blocking)
    apiFetch(`/api/listings/mine?bgg_game_id=${formData.bgg_game_id}&status=active`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data?.listings) {
          setDuplicateListings(data.listings);
        }
      })
      .catch(() => {
        // Silent failure — duplicate check is informational
      });

    return () => { cancelled = true; };
  }, [formData.bgg_game_id, formData.is_expansion]);

  // Enrich expansion metadata (thumbnails + alternate names) via single batch call.
  // Fires as soon as availableExpansions loads — before user even clicks "Yes".
  // enrich-batch now saves full metadata to DB, so individual enrich calls on
  // the Edition step become no-ops (ensureGameMetadata sees data already exists).
  const enrichedExpansionIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const missing = availableExpansions.filter(
      (e) => !enrichedExpansionIdsRef.current.has(e.id)
    );
    if (missing.length === 0) return;

    let cancelled = false;
    const ids = missing.map((e) => e.id).slice(0, 20);

    // Mark as attempted immediately to prevent duplicate calls
    for (const id of ids) enrichedExpansionIdsRef.current.add(id);

    apiFetch('/api/games/enrich-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data?.games) return;
        const games: Record<number, { thumbnail: string | null; image: string | null; alternate_names: string[] | null }> = data.games;

        // Update expansion thumbnails in the list
        setAvailableExpansions((prev) =>
          prev.map((exp) => {
            const enriched = games[exp.id];
            if (enriched?.thumbnail && !exp.thumbnail) {
              return { ...exp, thumbnail: enriched.thumbnail };
            }
            return exp;
          })
        );

        const newEnriched: Record<number, EnrichedGame> = {};
        for (const exp of missing) {
          const g = games[exp.id];
          if (g) {
            newEnriched[exp.id] = buildEnrichedGame(
              exp.id, exp.name, exp.year ?? null,
              { thumbnail: g.thumbnail, image: g.image, player_count: null, alternate_names: g.alternate_names },
            );
          }
        }
        if (Object.keys(newEnriched).length > 0) {
          setEnrichedExpansions((prev) => ({ ...prev, ...newEnriched }));
        }
      })
      .catch(() => {
        // Non-fatal — expansions render without alternate names
      });

    return () => { cancelled = true; };
  }, [availableExpansions]);

  const canProceed = (): boolean => {
    switch (currentStepId) {
      case 'game':
        // Need game selected AND (expansion gate answered OR no expansions available OR is expansion)
        if (formData.bgg_game_id === null) return false;
        if (loadingExpansions) return false;
        if (formData.is_expansion || availableExpansions.length === 0) return true;
        return expansionGateAnswer !== null;
      case 'edition':
        if (formData.version_source === 'bgg') return formData.bgg_version_id !== null;
        if (formData.version_source === 'manual') return formData.language !== null;
        return false;
      case 'details': {
        if (!formData.condition) return false;
        if (conditionRequiresPhotos(formData.condition) && formData.photos.length === 0) return false;
        if (conditionRequiresDescription(formData.condition) && !formData.description.trim()) return false;
        return true;
      }
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStepIndex < totalSteps - 1) {
      setCurrentStepId(steps[currentStepIndex + 1].id);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepId(steps[currentStepIndex - 1].id);
      window.scrollTo(0, 0);
    }
  };

  const handleEditStep = (targetStepIndex: number) => {
    // Map old numeric steps to step IDs for backward compat with ReviewPriceStep
    const stepMap: Record<number, StepId> = { 1: 'game', 2: 'edition', 3: 'details' };
    const targetId = stepMap[targetStepIndex];
    if (targetId && steps.some((s) => s.id === targetId)) {
      setCurrentStepId(targetId);
      window.scrollTo(0, 0);
    }
  };

  // Build expansion data for submit
  const buildExpansions = (): ListingExpansion[] => {
    return formData.selected_expansion_ids.map((id) => {
      const expansion = availableExpansions.find((e) => e.id === id);
      const version = formData.expansion_versions[id];
      return {
        bgg_game_id: id,
        game_name: formData.expansion_game_names[id] ?? expansion?.name ?? `Game ${id}`,
        ...(version ? {
          version_source: version.version_source,
          bgg_version_id: version.bgg_version_id,
          version_name: version.version_name,
          publisher: version.publisher,
          language: version.language,
          edition_year: version.edition_year,
          version_thumbnail: version.version_thumbnail,
        } : {}),
      };
    });
  };

  const handlePublish = async () => {
    if (publishing) return;
    if (!formData.bgg_game_id || !formData.condition) return;

    setPublishing(true);
    setError(null);

    const expansions = buildExpansions();

    const result = await createListing({
      bgg_game_id: formData.bgg_game_id,
      game_name: formData.game_name,
      game_year: formData.game_year,
      version_source: formData.version_source ?? 'manual',
      bgg_version_id: formData.bgg_version_id,
      version_name: formData.version_name,
      publisher: formData.publisher,
      language: formData.language,
      edition_year: formData.edition_year,
      version_thumbnail: formData.version_thumbnail,
      condition: formData.condition,
      price_cents: isAuction ? formData.starting_price_cents : formData.price_cents,
      description: formData.description || null,
      photos: formData.photos,
      offer_id: offerId,
      listing_type: listingType,
      ...(isAuction ? {
        starting_price_cents: formData.starting_price_cents,
        auction_duration_days: formData.auction_duration_days,
      } : {}),
      ...(expansions.length > 0 ? { expansions } : {}),
    }, turnstileToken);

    if ('error' in result) {
      setError(result.error);
      setPublishing(false);
      turnstileRef.current?.reset();
    } else {
      router.push(`/${locale}/listings/${result.listingId}`);
    }
  };

  // Expansion gate prompt: show after game selected, expansions loaded, not an expansion itself
  const showExpansionGate =
    currentStepId === 'game' &&
    formData.bgg_game_id !== null &&
    !formData.is_expansion &&
    !loadingExpansions &&
    availableExpansions.length > 0 &&
    expansionGateAnswer === null;

  // Show expansion gate answered state
  const showExpansionGateAnswered =
    currentStepId === 'game' &&
    formData.bgg_game_id !== null &&
    !formData.is_expansion &&
    availableExpansions.length > 0 &&
    expansionGateAnswer !== null;

  return (
    <div className="space-y-6">
      <Stepper
        steps={steps}
        currentStep={currentStepId}
      />

      {/* Step content */}
      <div className="min-h-[300px]">
        {currentStepId === 'game' && (
          <>
            <GameSearchStep
              selectedGameId={formData.bgg_game_id}
              selectedGame={selectedGame}
              locked={gameLocked}
              onSelect={(game) => {
                // If matched via alternate name, use that as the default listing name
                const defaultName = game.matchedAlternateName ?? game.name;

                // If selecting a different game, reset everything
                if (formData.bgg_game_id !== null && formData.bgg_game_id !== game.id) {
                  updateFormData({
                    bgg_game_id: game.id,
                    game_name: defaultName,
                    game_year: game.yearpublished,
                    game_thumbnail: game.thumbnail,
                    game_image: game.image,
                    game_player_count: game.player_count,
                    is_expansion: false, // Will be set by enrich if needed
                    selected_expansion_ids: [],
                    version_source: null,
                    bgg_version_id: null,
                    version_name: null,
                    publisher: null,
                    language: null,
                    edition_year: null,
                    version_thumbnail: null,
                    expansion_versions: {},
                    expansion_game_names: {},
                    condition: null,
                  });
                  setExpansionGateAnswer(null);
                  setEnrichedExpansions({});
                } else {
                  updateFormData({
                    bgg_game_id: game.id,
                    game_name: defaultName,
                    game_year: game.yearpublished,
                    game_thumbnail: game.thumbnail,
                    game_image: game.image,
                    game_player_count: game.player_count,
                  });
                }
                setSelectedGame(game);
              }}
            />

            {/* Loading expansions indicator */}
            {formData.bgg_game_id && loadingExpansions && (
              <div className="flex items-center gap-2 mt-4 text-sm text-semantic-text-muted">
                <Spinner size="sm" />
                <span>Checking for expansions...</span>
              </div>
            )}

            {/* Duplicate listing alert */}
            {duplicateListings.length > 0 && (
              <Alert variant="info" className="mt-4">
                <p className="font-medium">You already have {duplicateListings.length === 1 ? 'an active listing' : `${duplicateListings.length} active listings`} for this game</p>
                <div className="mt-2 space-y-2">
                  {duplicateListings.map((listing) => (
                    <a
                      key={listing.id}
                      href={`/${locale}/listings/${listing.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-semantic-brand hover:underline"
                    >
                      {listing.game_name} — {formatCentsToCurrency(listing.price_cents)}
                      {listing.expansion_count > 0 && (
                        <span className="text-semantic-text-muted ml-1">{formatExpansionCount(listing.expansion_count)}</span>
                      )}
                    </a>
                  ))}
                </div>
              </Alert>
            )}

            {/* Expansion gate prompt */}
            {showExpansionGate && (
              <Card className="mt-4">
                <CardBody>
                  <p className="text-sm font-medium text-semantic-text-primary mb-3">
                    Do you want to add any expansions?
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setExpansionGateAnswer(true)}
                    >
                      Yes
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpansionGateAnswer(false)}
                    >
                      No
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Inline expansion selection after answering Yes */}
            {showExpansionGateAnswered && expansionGateAnswer === true && (
              <div className="mt-4">
                <ExpansionStep
                  expansions={availableExpansions.map((e) => ({
                    ...e,
                    alternate_names: enrichedExpansions[e.id]?.alternateNames ?? null,
                  }))}
                  selectedExpansionIds={formData.selected_expansion_ids}
                  onSelectionChange={(ids) => updateFormData({ selected_expansion_ids: ids })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setExpansionGateAnswer(null);
                    setEnrichedExpansions({});
                    updateFormData({ selected_expansion_ids: [], expansion_versions: {}, expansion_game_names: {} });
                  }}
                >
                  Remove expansions
                </Button>
              </div>
            )}

            {/* Answered No — just show a change link */}
            {showExpansionGateAnswered && expansionGateAnswer === false && (
              <div className="mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpansionGateAnswer(null)}
                >
                  Add expansions
                </Button>
              </div>
            )}
          </>
        )}

        {currentStepId === 'edition' && formData.bgg_game_id && (() => {
          const hasExpansions = formData.selected_expansion_ids.length > 0;
          const baseGameStep = (
            <VersionStep
              userCountry={userCountry}
              gameId={formData.bgg_game_id}
              gameName={formData.game_name}
              selectedGame={selectedGame}
              onGameNameChange={(name: string) => updateFormData({ game_name: name })}
              selectedVersionId={formData.bgg_version_id}
              selectedVersionSource={formData.version_source}
              selectedPublisher={formData.publisher}
              selectedLanguage={formData.language}
              selectedEditionYear={formData.edition_year}
              cachedVersions={versionCache[formData.bgg_game_id]}
              onVersionsFetched={handleVersionsFetched}
              onSelect={(version) => {
                updateFormData({
                  version_source: version.version_source,
                  bgg_version_id: version.bgg_version_id,
                  version_name: version.version_name,
                  publisher: version.publisher,
                  language: version.language,
                  edition_year: version.edition_year,
                  version_thumbnail: version.version_thumbnail,
                });
              }}
            />
          );

          return (
          <div className="space-y-6">
            {hasExpansions ? (
              <div className="rounded-xl bg-semantic-bg-surface p-4 sm:p-6 border border-semantic-border-subtle">
                {baseGameStep}
              </div>
            ) : baseGameStep}

            {/* Expansions section */}
            {formData.selected_expansion_ids.length > 0 && (
              <div className="rounded-xl bg-semantic-bg-surface p-4 sm:p-6 border border-semantic-border-subtle space-y-6">
                {formData.selected_expansion_ids.map((expId, idx) => {
                  const expansion = availableExpansions.find((e) => e.id === expId);
                  if (!expansion) return null;
                  const expVersion = formData.expansion_versions[expId];

                  return (
                    <div key={expId}>
                      {idx > 0 && (
                        <hr className="border-semantic-border-subtle mb-6" />
                      )}
                      <VersionStep
                        userCountry={userCountry}
                        gameId={expId}
                        gameName={formData.expansion_game_names[expId] ?? expansion.name}
                        selectedGame={enrichedExpansions[expId] ?? null}
                        onGameNameChange={(name: string) => updateFormData({
                          expansion_game_names: { ...formData.expansion_game_names, [expId]: name },
                        })}
                        selectedVersionId={expVersion?.bgg_version_id ?? null}
                        selectedVersionSource={expVersion?.version_source ?? null}
                        selectedPublisher={expVersion?.publisher ?? null}
                        selectedLanguage={expVersion?.language ?? null}
                        selectedEditionYear={expVersion?.edition_year ?? null}
                        cachedVersions={versionCache[expId]}
                        onVersionsFetched={handleVersionsFetched}
                        onSelect={(version: VersionData) => {
                          updateFormData({
                            expansion_versions: {
                              ...formData.expansion_versions,
                              [expId]: version,
                            },
                          });
                        }}
                        compact
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          );
        })()}

        {currentStepId === 'details' && (
          <ConditionPhotosStep
            condition={formData.condition}
            photos={formData.photos}
            description={formData.description}
            onConditionChange={(condition) => updateFormData({ condition })}
            onPhotosChange={(photos) => updateFormData({ photos })}
            onDescriptionChange={(description) => updateFormData({ description })}
          />
        )}

        {currentStepId === 'review' && (
          <>
            <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />
            <ReviewPriceStep
              formData={formData}
              onPriceChange={(cents) => updateFormData(isAuction ? { starting_price_cents: cents } : { price_cents: cents })}
              onPublish={handlePublish}
              publishing={publishing}
              error={error}
              onEditStep={handleEditStep}
              lockedPrice={priceLocked ? formData.price_cents : undefined}
              isAuction={isAuction}
              auctionDurationDays={formData.auction_duration_days}
              onDurationChange={(days) => updateFormData({ auction_duration_days: days })}
              expansions={formData.selected_expansion_ids.map((id) => {
                const exp = availableExpansions.find((e) => e.id === id);
                return { id, name: formData.expansion_game_names[id] ?? exp?.name ?? `Game ${id}` };
              })}
            />
          </>
        )}
      </div>

      {/* Navigation */}
      {currentStepIndex >= 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-semantic-border-subtle">
          <div>
            {currentStepIndex > 0 && (
              <Button variant="ghost" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>
          {currentStepId !== 'review' && (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Continue
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
