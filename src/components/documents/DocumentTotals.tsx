import { formatPrice } from '@/lib/services/pricing';
import { cn } from '@/lib/cn';

interface TotalRow {
  label: string;
  amount: number;
  bold?: boolean;
}

interface DocumentTotalsProps {
  rows: TotalRow[];
}

export function DocumentTotals({ rows }: DocumentTotalsProps) {
  return (
    <div className="mt-6 flex justify-end">
      <div className="w-full max-w-xs space-y-1">
        {rows.map((row, i) => (
          <div
            key={i}
            className={cn(
              'flex justify-between text-sm',
              row.bold
                ? 'border-t border-semantic-text-heading pt-2 font-bold text-semantic-text-heading'
                : 'text-semantic-text-secondary',
            )}
          >
            <span>{row.label}</span>
            <span>{formatPrice(row.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
