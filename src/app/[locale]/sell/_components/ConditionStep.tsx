'use client';

import { ConditionBadge, InlineArrowLink } from '@/components/ui';
import { getConditionDetail } from '@/lib/condition-config';
import { conditionToBadgeKey, LISTING_CONDITIONS } from '@/lib/listings/types';
import type { ConditionBadgeKey, ListingCondition } from '@/lib/listings/types';

interface ConditionStepProps {
  selectedCondition: ListingCondition | null;
  onSelect: (condition: ListingCondition) => void;
  hideHeading?: boolean;
  /** Hide the internal condition-guide link so a parent can render its own. */
  hideGuideButton?: boolean;
}

const conditionBg: Record<ConditionBadgeKey, string> = {
  likeNew: 'bg-condition-like-new-bg',
  veryGood: 'bg-condition-very-good-bg',
  good: 'bg-condition-good-bg',
  acceptable: 'bg-condition-acceptable-bg',
  forParts: 'bg-condition-for-parts-bg',
};

export function ConditionStep({
  selectedCondition,
  onSelect,
  hideHeading,
  hideGuideButton,
}: ConditionStepProps) {
  return (
    <div className="space-y-4">
      {!hideHeading && (
        <h2 className="text-base font-semibold text-semantic-text-heading">Condition</h2>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {LISTING_CONDITIONS.map((condition) => {
            const badgeKey = conditionToBadgeKey[condition];
            const isSelected = selectedCondition === condition;

            return (
              <button
                key={condition}
                type="button"
                onClick={() => onSelect(condition)}
                className={`p-1.5 rounded-lg transition-colors duration-250 ease-out-custom ${
                  isSelected
                    ? conditionBg[badgeKey]
                    : 'bg-transparent hover:bg-semantic-bg-secondary'
                }`}
              >
                <ConditionBadge condition={condition} />
              </button>
            );
          })}
        </div>
        {selectedCondition && (
          <p className="text-sm text-semantic-text-secondary leading-relaxed">
            {getConditionDetail(selectedCondition)}
          </p>
        )}
      </div>

      {!hideGuideButton && (
        <InlineArrowLink href="/condition-guide" size="sm" target="_blank">
          See the condition guide
        </InlineArrowLink>
      )}
    </div>
  );
}
