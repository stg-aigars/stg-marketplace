'use client';

import { useEffect, useRef } from 'react';
import { InlineArrowLink, Textarea } from '@/components/ui';
import { ConditionStep } from './ConditionStep';
import { PhotoUploadStep } from './PhotoUploadStep';
import { ComponentUpgradesPicker } from './ComponentUpgradesPicker';
import { conditionRequiresPhotos, conditionRequiresDescription, MAX_DESCRIPTION_LENGTH } from '@/lib/listings/types';
import type { ListingCondition, ComponentUpgrade } from '@/lib/listings/types';
import { SECTION_HEADING_CLASS } from '@/lib/heading-classes';

interface ConditionPhotosStepProps {
  gameId: number | null;
  condition: ListingCondition | null;
  photos: string[];
  description: string;
  componentUpgrades: ComponentUpgrade[];
  onConditionChange: (condition: ListingCondition) => void;
  onPhotosChange: (photos: string[]) => void;
  onDescriptionChange: (desc: string) => void;
  onComponentUpgradesChange: (upgrades: ComponentUpgrade[]) => void;
}

export function ConditionPhotosStep({
  gameId,
  condition,
  photos,
  description,
  componentUpgrades,
  onConditionChange,
  onPhotosChange,
  onDescriptionChange,
  onComponentUpgradesChange,
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className={SECTION_HEADING_CLASS}>
          Describe your copy
        </h2>
        <p className="text-sm text-semantic-text-secondary mt-1">
          Pick the condition, add a few photos, and note anything specific.
        </p>
      </div>

      {/* Condition */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
            Condition
          </p>
          <InlineArrowLink href="/condition-guide" size="sm" target="_blank">
            See the condition guide
          </InlineArrowLink>
        </div>
        <ConditionStep
          hideHeading
          hideGuideButton
          selectedCondition={condition}
          onSelect={onConditionChange}
        />
      </div>

      {condition && <hr className="border-semantic-border-subtle" />}

      {/* Photos — visible after condition is selected */}
      {condition && (
        <div ref={photoSectionRef} className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
              Photos{photosRequired && <span className="text-semantic-error"> *</span>}
            </p>
            <p className="text-sm text-semantic-text-secondary mt-1">
              {photosRequired
                ? 'Buyers need to see the condition of your copy.'
                : 'Listings with photos get more interest.'}
            </p>
          </div>
          <PhotoUploadStep
            compact
            heading={null}
            photos={photos}
            onPhotosChange={onPhotosChange}
            requiredMin={photosRequired ? 1 : undefined}
          />
        </div>
      )}

      {condition && <hr className="border-semantic-border-subtle" />}

      {/* Notes */}
      {condition && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
              Notes{descriptionRequired && <span className="text-semantic-error"> *</span>}
            </p>
            <p className="text-sm text-semantic-text-secondary mt-1">
              {descriptionRequired
                ? "Help buyers understand exactly what they're getting."
                : 'Anything else a buyer should know?'}
            </p>
          </div>
          <Textarea
            id="listing-description"
            value={description}
            onChange={(e) => {
              if (e.target.value.length <= MAX_DESCRIPTION_LENGTH) {
                onDescriptionChange(e.target.value);
              }
            }}
            placeholder="e.g. All components present, light shelf wear on the box. Played a few times."
            rows={4}
          />
          <p className="text-xs text-semantic-text-muted text-right">
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </p>
        </div>
      )}

      {condition && gameId && <hr className="border-semantic-border-subtle" />}

      {/* Included extras / component upgrades */}
      {condition && gameId && (
        <ComponentUpgradesPicker
          gameId={gameId}
          value={componentUpgrades}
          onChange={onComponentUpgradesChange}
        />
      )}
    </div>
  );
}
