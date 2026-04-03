'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Stepper, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { createListing } from '@/lib/listings/actions';
import type { ListingCondition, ListingType, VersionSource } from '@/lib/listings/types';
import { conditionRequiresPhotos, conditionRequiresDescription } from '@/lib/listings/types';
import { GameSearchStep } from './GameSearchStep';
import type { EnrichedGame } from './GameSearchStep';
import { VersionStep } from './VersionStep';
import { ConditionPhotosStep } from './ConditionPhotosStep';
import { ReviewPriceStep } from './ReviewPriceStep';

const STEPS = [
  { id: 'game', label: 'Game' },
  { id: 'edition', label: 'Edition' },
  { id: 'details', label: 'Details' },
  { id: 'review', label: 'Review' },
];

export interface FormData {
  // Step 1: Game
  bgg_game_id: number | null;
  game_name: string;
  game_year: number | null;
  game_thumbnail: string | null;
  game_image: string | null;
  game_player_count: string | null;
  // Step 2: Version
  version_source: VersionSource | null;
  bgg_version_id: number | null;
  version_name: string | null;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
  version_thumbnail: string | null;
  // Step 3: Condition, photos & description
  photos: string[];
  condition: ListingCondition | null;
  description: string;
  // Step 4: Price (set on review step)
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
  version_source: null,
  bgg_version_id: null,
  version_name: null,
  publisher: null,
  language: null,
  edition_year: null,
  version_thumbnail: null,
  photos: [],
  condition: null,
  price_cents: 0,
  description: '',
  starting_price_cents: 0,
  auction_duration_days: 3,
};

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
  // When game is locked, skip to step 2 (edition)
  const [step, setStep] = useState(gameLocked ? 2 : 1);
  const [formData, setFormData] = useState<FormData>(() =>
    initialData ? { ...initialFormData, ...initialData } : initialFormData
  );
  const [selectedGame, setSelectedGame] = useState<EnrichedGame | null>(initialGame ?? null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const updateFormData = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return formData.bgg_game_id !== null;
      case 2:
        if (formData.version_source === 'bgg') return formData.bgg_version_id !== null;
        if (formData.version_source === 'manual') return formData.language !== null;
        return false;
      case 3: {
        if (!formData.condition) return false;
        if (conditionRequiresPhotos(formData.condition) && formData.photos.length === 0) return false;
        if (conditionRequiresDescription(formData.condition) && !formData.description.trim()) return false;
        return true;
      }
      case 4:
        return true; // Price validated by Publish button inside ReviewPriceStep
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && step < 4) {
      setStep(step + 1);
    }
  };

  const minStep = gameLocked ? 2 : 1;

  const handleBack = () => {
    if (step > minStep) {
      setStep(step - 1);
    }
  };

  const handleEditStep = (targetStep: number) => setStep(targetStep);

  const handlePublish = async () => {
    if (publishing) return;
    if (!formData.bgg_game_id || !formData.condition) return;

    setPublishing(true);
    setError(null);

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
    }, turnstileToken);

    if ('error' in result) {
      setError(result.error);
      setPublishing(false);
      turnstileRef.current?.reset();
    } else {
      router.push(`/${locale}/listings/${result.listingId}`);
    }
  };

  return (
    <div className="space-y-6">
      <Stepper
        steps={gameLocked ? STEPS.filter((s) => s.id !== 'game') : STEPS}
        currentStep={STEPS[step - 1].id}
      />

      {/* Step content */}
      <div className="min-h-[300px]">
        {step === 1 && (
          <GameSearchStep
            selectedGameId={formData.bgg_game_id}
            selectedGame={selectedGame}
            locked={gameLocked}
            onSelect={(game) => {
              // If selecting a different game, reset version/condition/etc fields
              if (formData.bgg_game_id !== null && formData.bgg_game_id !== game.id) {
                updateFormData({
                  bgg_game_id: game.id,
                  game_name: game.name,
                  game_year: game.yearpublished,
                  game_thumbnail: game.thumbnail,
                  game_image: game.image,
                  game_player_count: game.player_count,
                  // Reset version fields
                  version_source: null,
                  bgg_version_id: null,
                  version_name: null,
                  publisher: null,
                  language: null,
                  edition_year: null,
                  version_thumbnail: null,
                  // Reset condition
                  condition: null,
                });
              } else {
                updateFormData({
                  bgg_game_id: game.id,
                  game_name: game.name,
                  game_year: game.yearpublished,
                  game_thumbnail: game.thumbnail,
                  game_image: game.image,
                  game_player_count: game.player_count,
                });
              }
              setSelectedGame(game);
            }}
          />
        )}

        {step === 2 && formData.bgg_game_id && (
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
        )}

        {step === 3 && (
          <ConditionPhotosStep
            condition={formData.condition}
            photos={formData.photos}
            description={formData.description}
            onConditionChange={(condition) => updateFormData({ condition })}
            onPhotosChange={(photos) => updateFormData({ photos })}
            onDescriptionChange={(description) => updateFormData({ description })}
          />
        )}

        {step === 4 && (
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
            />
          </>
        )}
      </div>

      {/* Navigation */}
      {step <= 4 && (
        <div className="flex items-center justify-between pt-4 border-t border-semantic-border-subtle">
          <div>
            {step > minStep && (
              <Button variant="ghost" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>
          {step < 4 && (
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
