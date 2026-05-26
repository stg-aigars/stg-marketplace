import { formatCentsToCurrency } from '@/lib/services/pricing';
import { cn } from '@/lib/cn';

interface PriceProps {
  cents: number;
  /**
   * When set, renders a struck-through old price before the current price.
   * Pre-computed by callers via `isPriceDropActive(listing)` so the
   * strike + 14-day visibility logic stays in one place.
   */
  previousCents?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'text-[13px]',
  md: 'text-[15px]',
  lg: 'text-xl',
  xl: 'text-3xl',
} as const;

function Price({ cents, previousCents, size = 'md', className = '' }: PriceProps) {
  const current = formatCentsToCurrency(cents);
  const previous = previousCents !== undefined ? formatCentsToCurrency(previousCents) : null;

  return (
    <span
      className={cn(sizeClasses[size], 'font-bold font-sans tracking-tight text-semantic-text-heading', className)}
      aria-label={previous ? `Price dropped from ${previous} to ${current}` : undefined}
    >
      {current}
      {previous && (
        <s className="font-normal text-semantic-text-muted ml-2 text-[0.5em]" aria-hidden="true">
          {previous}
        </s>
      )}
    </span>
  );
}

export { Price };
export type { PriceProps };
