'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { ConditionStep } from './ConditionStep';
import { PhotoUploadStep } from './PhotoUploadStep';
import { conditionRequiresPhotos, conditionRequiresDescription, MAX_DESCRIPTION_LENGTH } from '@/lib/listings/types';
import type { ListingCondition } from '@/lib/listings/types';
import { toBggFullSize, isBggImage } from '@/lib/bgg/utils';

interface ConditionPhotosStepProps {
  condition: ListingCondition | null;
  photos: string[];
  description: string;
  gameImageUrl: string | null;
  onConditionChange: (condition: ListingCondition) => void;
  onPhotosChange: (photos: string[]) => void;
  onDescriptionChange: (desc: string) => void;
}

export function ConditionPhotosStep({
  condition,
  photos,
  description,
  gameImageUrl,
  onConditionChange,
  onPhotosChange,
  onDescriptionChange,
}: ConditionPhotosStepProps) {
  const photoSectionRef = useRef<HTMLDivElement>(null);
  const prevConditionRef = useRef(condition);

  // Scroll photo section into view when condition is first selected or changed
  useEffect(() => {
    if (condition && condition !== prevConditionRef.current) {
      prevConditionRef.current = condition;
      // Small delay to let the photo section render if it was hidden
      requestAnimationFrame(() => {
        photoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }, [condition]);

  const photosRequired = condition ? conditionRequiresPhotos(condition) : false;
  const descriptionRequired = condition ? conditionRequiresDescription(condition) : false;
  const fullSizeImageUrl = toBggFullSize(gameImageUrl);
  const showBggFallback = condition && !photosRequired && photos.length === 0 && fullSizeImageUrl;

  const photoLabel = photosRequired ? 'Photos (required)' : 'Photos (optional)';
  const notesLabel = descriptionRequired ? 'Notes for buyer' : 'Notes for buyer (optional)';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
          Describe your copy
        </h2>
        <p className="text-sm text-semantic-text-secondary mt-1">
          Select condition, add photos, and note any details
        </p>
      </div>

      {/* 1. Condition selector */}
      <div>
        <p className="text-sm font-semibold text-semantic-text-secondary mb-3">1. Condition</p>
        <ConditionStep
          compact
          hideHeading
          selectedCondition={condition}
          onSelect={onConditionChange}
        />
      </div>

      {/* 2. Photo upload — visible after condition is selected */}
      {condition && (
        <div ref={photoSectionRef} className="border-t border-semantic-border-subtle pt-4 mt-4 space-y-3">
          <p className="text-sm font-semibold text-semantic-text-secondary mb-3">2. {photoLabel}</p>
          <PhotoUploadStep
            compact
            heading={null}
            photos={photos}
            onPhotosChange={onPhotosChange}
          />

          {photosRequired && (
            <p className="text-sm text-semantic-text-secondary">
              Buyers need to see the condition of your game
            </p>
          )}

          {!photosRequired && (
            <p className="text-sm text-semantic-text-muted">
              Listings with photos get more interest
            </p>
          )}

          {/* BGG cover fallback preview when no photos and optional */}
          {showBggFallback && (
            <div className="flex items-center gap-3 bg-semantic-bg-surface rounded-lg px-3 py-2.5">
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 relative bg-semantic-bg-secondary">
                <Image
                  src={fullSizeImageUrl}
                  alt="Game cover"
                  fill
                  className="object-contain"
                  sizes="48px"
                  unoptimized={isBggImage(fullSizeImageUrl)}
                />
              </div>
              <p className="text-sm text-semantic-text-muted">
                Buyers will see the game cover image
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. Seller notes textarea */}
      {condition && (
        <div className="border-t border-semantic-border-subtle pt-4 mt-4">
          <p className="text-sm font-semibold text-semantic-text-secondary mb-3">
            3. {notesLabel}{descriptionRequired && <span className="text-semantic-error"> *</span>}
          </p>
          <textarea
            id="listing-description"
            value={description}
            onChange={(e) => {
              if (e.target.value.length <= MAX_DESCRIPTION_LENGTH) {
                onDescriptionChange(e.target.value);
              }
            }}
            placeholder="Describe any wear, missing components, or other details about the game's condition"
            rows={4}
            className="block w-full rounded-lg border border-semantic-border-default px-3 py-2.5 text-base sm:text-sm text-semantic-text-primary bg-semantic-bg-elevated placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-brand/20 focus:border-semantic-brand resize-none"
          />
          <div className="flex justify-between mt-1">
            {descriptionRequired && (
              <p className="text-xs text-semantic-text-muted">
                Help buyers understand exactly what they're getting
              </p>
            )}
            <p className="text-xs text-semantic-text-muted text-right ml-auto">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
