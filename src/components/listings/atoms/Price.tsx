import { formatCentsToCurrency } from '@/lib/services/pricing';

interface PriceProps {
  cents: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'text-[13px]',
  md: 'text-[15px]',
  lg: 'text-xl',
} as const;

function Price({ cents, size = 'md', className = '' }: PriceProps) {
  return (
    <span className={`${sizeClasses[size]} font-bold font-sans tracking-tight text-semantic-text-heading ${className}`}>
      {formatCentsToCurrency(cents)}
    </span>
  );
}

export { Price };
export type { PriceProps };
