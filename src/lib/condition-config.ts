import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';

export const conditionConfig = {
  likeNew: {
    label: 'Like New',
    variant: 'success' as const,
    description: 'Appears unplayed or played once. No signs of wear.',
  },
  veryGood: {
    label: 'Very Good',
    variant: 'default' as const,
    description: 'Minimal wear. Components in great shape.',
  },
  good: {
    label: 'Good',
    variant: 'warning' as const,
    description: 'Shows play wear but fully functional.',
  },
  acceptable: {
    label: 'Acceptable',
    variant: 'warning' as const,
    description: 'Significant wear but complete and playable.',
  },
  forParts: {
    label: 'For Parts',
    variant: 'error' as const,
    description: 'Missing play-essential components or not playable. Sold as-is.',
  },
};

/** Get the display label for a listing condition (e.g., "Like New", "Very Good"). */
export function getConditionLabel(condition: ListingCondition): string {
  return conditionConfig[conditionToBadgeKey[condition]].label;
}
