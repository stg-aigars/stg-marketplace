'use client';

import { useState } from 'react';
import { Card, CardBody, Badge, Modal, Button } from '@/components/ui';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, LISTING_CONDITIONS } from '@/lib/listings/types';
import type { ListingCondition } from '@/lib/listings/types';

interface ConditionStepProps {
  selectedCondition: ListingCondition | null;
  onSelect: (condition: ListingCondition) => void;
}

const conditionExamples: Record<string, string> = {
  likeNew: 'Shrink wrap removed but all components still in original packaging. No signs of play.',
  veryGood: 'Played a few times. Box corners slightly worn but all cards, tokens, and pieces in excellent shape.',
  good: 'Regularly played. Box shows wear, cards may have light edge wear. Everything works and is included.',
  acceptable: 'Well-loved copy. Box may be taped, some components show significant wear. Still fully playable.',
  forParts: 'Missing pieces or damaged beyond normal play. Useful for replacing lost components or crafts.',
};

export function ConditionStep({ selectedCondition, onSelect }: ConditionStepProps) {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
        What condition is it in?
      </h2>
      <p className="text-sm text-semantic-text-secondary">
        Be honest — it builds trust with buyers and avoids disputes.
      </p>

      <div className="space-y-2">
        {LISTING_CONDITIONS.map((condition) => {
          const badgeKey = conditionToBadgeKey[condition];
          const config = conditionConfig[badgeKey];
          const isSelected = selectedCondition === condition;

          return (
            <Card
              key={condition}
              hoverable
              className={`cursor-pointer transition-all ${
                isSelected
                  ? 'border-2 border-semantic-primary shadow-md'
                  : ''
              }`}
              onClick={() => onSelect(condition)}
            >
              <CardBody className="py-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge condition={badgeKey}>{config.label}</Badge>
                    </div>
                    <p className="text-sm text-semantic-text-secondary">
                      {config.description}
                    </p>
                  </div>
                  {isSelected && (
                    <svg className="w-5 h-5 text-semantic-primary shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

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
                  <Badge condition={badgeKey}>{config.label}</Badge>
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
