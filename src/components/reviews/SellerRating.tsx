import { ThumbsUp } from '@phosphor-icons/react/ssr';

interface SellerRatingProps {
  positivePct: number;
  ratingCount: number;
  size?: 'sm' | 'md';
}

export function SellerRating({ positivePct, ratingCount, size = 'md' }: SellerRatingProps) {
  if (ratingCount === 0) {
    return (
      <span className={`text-semantic-text-muted ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        New seller
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <ThumbsUp size={size === 'sm' ? 14 : 16} weight="fill" className="text-semantic-accent" />
      <span className={positivePct >= 80 ? 'text-semantic-accent font-medium' : 'text-semantic-text-secondary'}>
        {positivePct}% positive
      </span>
      <span className="text-semantic-text-muted">({ratingCount})</span>
    </span>
  );
}
