'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Stepper, TurnstileWidget, Alert, Card, CardBody, Spinner } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { createListing } from '@/lib/listings/actions';
import type { ListingCondition, ListingType, VersionSource, ListingExpansion } from '@/lib/listings/types';
import { conditionRequiresPhotos, conditionRequiresDescription } from '@/lib/listings/types';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { apiFetch } from '@/lib/api-fetch';
import { GameSearchStep } from './GameSearchStep';
import type { EnrichedGame } from './GameSearchStep';
import { VersionStep } from './VersionStep';
import { ConditionPhotosStep } from './ConditionPhotosStep';
import { ReviewPriceStep } from './ReviewPriceStep';
import { ExpansionStep } from './ExpansionStep';
import type { VersionData } from '@/lib/listings/types';

interface GameExpansion {
  id: number;
  name: string;
  year?: number;
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
  photos: [],
  condition: null,
  price_cents: 0,
  description: '',
  starting_price_cents: 0,
  auction_duration_days: 3,
};

type StepId = 'game' | 'expansions' | 'edition' | 'details' | 'review';

interface ListingCreationFlowProps {
  initialData?: Partial<FormData>;
  initialGame?: EnrichedGame | null;
  lockedFields?: ('game' | 'price')[];
  offerId?: string;
  wantedOfferId?: string;
  listingType?: ListingType;
}

export function ListingCreationFlow({
  initialData,
  initialGame,
  lockedFields = [],
  offerId,
  wantedOfferId,
  listingType = 'fixed_price',
}: ListingCreationFlowProps = {}) {
  const isAuction = listingType === 'auction';
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
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

  // Dynamic steps based on whether expansion step is shown
  const showExpansionStep = expansionGateAnswer === true;

  const steps = useMemo(() => {
    const allSteps: { id: StepId; label: string }[] = [
      { id: 'game', label: 'Game' },
      ...(showExpansionStep ? [{ id: 'expansions' as const, label: 'Expansions' }] : []),
      { id: 'edition', label: 'Edition' },
      { id: 'details', label: 'Details' },
      { id: 'review', label: 'Review' },
    ];
    return gameLocked ? allSteps.filter((s) => s.id !== 'game') : allSteps;
  }, [showExpansionStep, gameLocked]);

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

  const canProceed = (): boolean => {
    switch (currentStepId) {
      case 'game':
        // Need game selected AND (expansion gate answered OR no expansions available OR is expansion)
        if (formData.bgg_game_id === null) return false;
        if (loadingExpansions) return false;
        if (formData.is_expansion || availableExpansions.length === 0) return true;
        return expansionGateAnswer !== null;
      case 'expansions':
        return true; // Optional — seller can skip without selecting any
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
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepId(steps[currentStepIndex - 1].id);
    }
  };

  const handleEditStep = (targetStepIndex: number) => {
    // Map old numeric steps to step IDs for backward compat with ReviewPriceStep
    const stepMap: Record<number, StepId> = { 1: 'game', 2: 'edition', 3: 'details' };
    const targetId = stepMap[targetStepIndex];
    if (targetId && steps.some((s) => s.id === targetId)) {
      setCurrentStepId(targetId);
    }
  };

  // Build expansion data for submit
  const buildExpansions = (): ListingExpansion[] => {
    return formData.selected_expansion_ids.map((id) => {
      const expansion = availableExpansions.find((e) => e.id === id);
      const version = formData.expansion_versions[id];
      return {
        bgg_game_id: id,
        game_name: expansion?.name ?? `Game ${id}`,
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
      wanted_offer_id: wantedOfferId,
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
                    condition: null,
                  });
                  setExpansionGateAnswer(null);
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
                        <span className="text-semantic-text-muted ml-1">+{listing.expansion_count} expansions</span>
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

            {/* Expansion gate answered indicator */}
            {showExpansionGateAnswered && (
              <div className="mt-4 flex items-center gap-2 text-sm text-semantic-text-muted">
                <span>
                  {expansionGateAnswer === true
                    ? 'Add expansions: Yes'
                    : 'Add expansions: No'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setExpansionGateAnswer(null);
                    if (expansionGateAnswer === true) {
                      updateFormData({ selected_expansion_ids: [], expansion_versions: {} });
                    }
                  }}
                >
                  Change
                </Button>
              </div>
            )}
          </>
        )}

        {currentStepId === 'expansions' && (
          <ExpansionStep
            expansions={availableExpansions}
            selectedExpansionIds={formData.selected_expansion_ids}
            onSelectionChange={(ids) => updateFormData({ selected_expansion_ids: ids })}
          />
        )}

        {currentStepId === 'edition' && formData.bgg_game_id && (
          <div className="space-y-8">
            {/* Base game version */}
            <div>
              {formData.selected_expansion_ids.length > 0 && (
                <p className="text-sm font-medium text-semantic-text-muted mb-2">Base game edition</p>
              )}
              <VersionStep
                gameId={formData.bgg_game_id}
                gameName={formData.game_name}
                selectedGame={selectedGame}
                onGameNameChange={(name: string) => updateFormData({ game_name: name })}
                selectedVersionId={formData.bgg_version_id}
                selectedVersionSource={formData.version_source}
                selectedPublisher={formData.publisher}
                selectedLanguage={formData.language}
                selectedEditionYear={formData.edition_year}
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
            </div>

            {/* Expansion version selectors */}
            {formData.selected_expansion_ids.map((expId) => {
              const expansion = availableExpansions.find((e) => e.id === expId);
              if (!expansion) return null;
              const expVersion = formData.expansion_versions[expId];
              return (
                <div key={expId}>
                  <p className="text-sm font-medium text-semantic-text-muted mb-2">
                    {expansion.name} edition
                    <span className="text-semantic-text-muted font-normal ml-1">(optional)</span>
                  </p>
                  <VersionStep
                    gameId={expId}
                    gameName={expansion.name}
                    selectedVersionId={expVersion?.bgg_version_id ?? null}
                    selectedVersionSource={expVersion?.version_source ?? null}
                    selectedPublisher={expVersion?.publisher ?? null}
                    selectedLanguage={expVersion?.language ?? null}
                    selectedEditionYear={expVersion?.edition_year ?? null}
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
                return { id, name: exp?.name ?? `Game ${id}` };
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
