'use client';

import { useEffect, useRef } from 'react';
import { Card, CardBody } from '@/components/ui';
import { ConditionStep } from './ConditionStep';
import { PhotoUploadStep } from './PhotoUploadStep';
import { conditionRequiresPhotos, conditionRequiresDescription, MAX_DESCRIPTION_LENGTH } from '@/lib/listings/types';
import type { ListingCondition } from '@/lib/listings/types';

interface ConditionPhotosStepProps {
  condition: ListingCondition | null;
  photos: string[];
  description: string;
  onConditionChange: (condition: ListingCondition) => void;
  onPhotosChange: (photos: string[]) => void;
  onDescriptionChange: (desc: string) => void;
}

export function ConditionPhotosStep({
  condition,
  photos,
  description,
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

      {/* 1. Condition */}
      <Card>
        <CardBody>
          <p className="text-sm font-semibold text-semantic-text-secondary mb-3">1. Condition</p>
          <ConditionStep
            compact
            hideHeading
            selectedCondition={condition}
            onSelect={onConditionChange}
          />
        </CardBody>
      </Card>

      {/* 2. Photos — visible after condition is selected */}
      {condition && (
        <div ref={photoSectionRef}>
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm font-semibold text-semantic-text-secondary">2. {photoLabel}</p>
            <PhotoUploadStep
              compact
              heading={null}
              photos={photos}
              onPhotosChange={onPhotosChange}
              requiredMin={photosRequired ? 1 : undefined}
            />

            {photosRequired ? (
              <p className="text-sm text-semantic-text-secondary">
                Buyers need to see the condition of your game
              </p>
            ) : (
              <p className="text-sm text-semantic-text-muted">
                Listings with photos get more interest
              </p>
            )}
          </CardBody>
        </Card>
        </div>
      )}

      {/* 3. Notes */}
      {condition && (
        <Card>
          <CardBody>
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
          </CardBody>
        </Card>
      )}
    </div>
  );
}
