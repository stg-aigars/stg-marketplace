import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';

export const conditionConfig = {
  likeNew: {
    label: 'Like New',
  },
  veryGood: {
    label: 'Very Good',
  },
  good: {
    label: 'Good',
  },
  acceptable: {
    label: 'Acceptable',
  },
  forParts: {
    label: 'For Parts',
  },
};

export const conditionGuide = {
  likeNew: {
    example: 'Shrink wrap removed but all components still in original packaging. No signs of play.',
    detail:
      'A copy that looks like it just came home from the shop. Components are pristine — cards crisp, tokens unscuffed, board flat. The box might have the faint wear of having been opened and closed, but nothing more. Non-essential omissions — extra-language rulebooks, scorepads, inserts, promos — are noted in the listing description, not graded down.',
    sellerHint:
      'Use this only if the cards have never been played, sleeved or not, and the box has never been stacked under heavier games. If you are unsure, pick Very Good — it costs nothing and protects the trade.',
  },
  veryGood: {
    example: 'Played a few times. Box corners slightly worn but all cards, tokens, and pieces in excellent shape.',
    detail:
      'Played a handful of times and well looked after. Cards may have light shuffle marks at the edges, but no visible bends or scratches. The box might show small dings at the corners. All play-essential components are present and in clear shape; non-essential omissions are noted in the listing description, not graded down.',
    sellerHint:
      'This is where most carefully kept copies land. If a card is bent, a token is scuffed, or a component shows a chip, drop to Good.',
  },
  good: {
    example: 'Regularly played. Box shows wear, cards may have light edge wear. Everything works and is included.',
    detail:
      'A regularly played copy with honest signs of use. Cards may have edge wear or shuffle creases, the box shows visible wear at corners and edges, and the rulebook may be folded or marked. All play-essential components are present and functional; non-essential omissions are noted in the listing description, not graded down.',
    sellerHint:
      'If wear is significant enough to affect play — bent cards, warped boards, taped boxes — drop to Acceptable. If a play-essential component is missing or broken beyond use, pick For Parts and call it out clearly in the description.',
  },
  acceptable: {
    example: 'Well-loved copy. Box may be taped, some components show significant wear. Still fully playable.',
    detail:
      'A well-loved copy that is still fully playable, with all play-essential components present. The box may be taped, components may show significant wear, and the rulebook may be soft or torn — but everything needed to play is there. Photos and a description are required at this tier.',
    sellerHint:
      'Use this when wear is heavy but everything needed to play is there. If a play-essential component is missing or broken beyond use, pick For Parts.',
  },
  forParts: {
    example: 'Missing pieces or damaged beyond normal play. Useful for replacing lost components or crafts.',
    detail:
      'Missing or broken play-essential components, or otherwise not playable as-is. Sold for crafts, replacements, or as a starting point for a homebrew copy. Buyers should expect to use it for components rather than for play. Photos and a description are required at this tier.',
    sellerHint:
      'Be specific in the description: which components are missing or broken, and which are intact. Buyers expect photos of the damaged or missing parts.',
  },
} as const;

/** Get the display label for a listing condition (e.g., "Like New", "Very Good"). */
export function getConditionLabel(condition: ListingCondition): string {
  return conditionConfig[conditionToBadgeKey[condition]].label;
}
