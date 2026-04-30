'use client';

import { useState } from 'react';
import { CheckCircle } from '@phosphor-icons/react/ssr';
import { Card, CardBody, ConditionBadge, Modal, Button } from '@/components/ui';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, LISTING_CONDITIONS } from '@/lib/listings/types';
import type { ListingCondition } from '@/lib/listings/types';

interface ConditionStepProps {
  selectedCondition: ListingCondition | null;
  onSelect: (condition: ListingCondition) => void;
  compact?: boolean;
  hideHeading?: boolean;
}

const conditionBg: Record<string, string> = {
  likeNew: 'bg-condition-like-new-bg',
  veryGood: 'bg-condition-very-good-bg',
  good: 'bg-condition-good-bg',
  acceptable: 'bg-condition-acceptable-bg',
  forParts: 'bg-condition-for-parts-bg',
};

const conditionExamples: Record<string, string> = {
  likeNew: 'Shrink wrap removed but all components still in original packaging. No signs of play.',
  veryGood: 'Played a few times. Box corners slightly worn but all cards, tokens, and pieces in excellent shape.',
  good: 'Regularly played. Box shows wear, cards may have light edge wear. Everything works and is included.',
  acceptable: 'Well-loved copy. Box may be taped, some components show significant wear. Still fully playable.',
  forParts: 'Missing pieces or damaged beyond normal play. Useful for replacing lost components or crafts.',
};

export function ConditionStep({ selectedCondition, onSelect, compact, hideHeading }: ConditionStepProps) {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="space-y-4">
      {compact ? (
        !hideHeading && <h2 className="text-base font-semibold text-semantic-text-heading">Condition</h2>
      ) : (
        <>
          <h2 className="text-xl sm:text-2xl font-semibold font-platform tracking-tight text-semantic-text-heading">
            What condition is it in?
          </h2>
          <p className="text-sm text-semantic-text-secondary">
            Be honest — it builds trust with buyers and avoids disputes.
          </p>
        </>
      )}

      {compact ? (
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
          <div className="min-h-[20px]">
            {selectedCondition && (
              <p className="text-sm text-semantic-text-secondary">
                {conditionConfig[conditionToBadgeKey[selectedCondition]].description}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {LISTING_CONDITIONS.map((condition) => {
            const badgeKey = conditionToBadgeKey[condition];
            const config = conditionConfig[badgeKey];
            const isSelected = selectedCondition === condition;

            return (
              <Card
                key={condition}
                hoverable
                className={`cursor-pointer transition-all duration-350 ease-out-custom ${
                  isSelected
                    ? 'border-2 border-semantic-brand shadow-md'
                    : ''
                }`}
                onClick={() => onSelect(condition)}
              >
                <CardBody className="py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <ConditionBadge condition={condition} />
                      </div>
                      <p className="text-sm text-semantic-text-secondary">
                        {config.description}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle size={20} weight="fill" className="text-semantic-brand shrink-0 mt-0.5" />
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={() => setShowGuide(true)}>
        What do these mean?
      </Button>

      <Modal
        open={showGuide}
        onClose={() => setShowGuide(false)}
        title="Condition guide"
      >
        <div className="space-y-5">
          {LISTING_CONDITIONS.map((condition) => {
            const badgeKey = conditionToBadgeKey[condition];
            const config = conditionConfig[badgeKey];

            return (
              <div key={condition}>
                <div className="flex items-center gap-2 mb-1.5">
                  <ConditionBadge condition={condition} />
                </div>
                <p className="text-sm text-semantic-text-primary mb-1">
                  {config.description}
                </p>
                <p className="text-sm text-semantic-text-muted italic">
                  Example: {conditionExamples[badgeKey]}
                </p>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
