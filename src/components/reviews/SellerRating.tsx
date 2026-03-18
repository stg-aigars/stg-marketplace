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
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-semantic-success`}>
        <path d="M1 8.25a1.25 1.25 0 1 1 2.5 0v7.5a1.25 1.25 0 1 1-2.5 0v-7.5ZM11 3V1.7c0-.268.14-.526.395-.607A2 2 0 0 1 14 3c0 .995-.182 1.948-.514 2.826-.204.54.166 1.174.744 1.174h2.52c1.243 0 2.261 1.01 2.146 2.247a23.864 23.864 0 0 1-1.341 5.974 1.457 1.457 0 0 1-1.456 1.029H8.25a.75.75 0 0 1-.75-.75v-7a.75.75 0 0 1 .127-.416 24.11 24.11 0 0 0 3.373-8.084Z" />
      </svg>
      <span className={positivePct >= 80 ? 'text-semantic-success font-medium' : 'text-semantic-text-secondary'}>
        {positivePct}% positive
      </span>
      <span className="text-semantic-text-muted">({ratingCount})</span>
    </span>
  );
}
