import Link from 'next/link';
import { WarningCircle } from '@phosphor-icons/react/ssr';
import { Alert } from '@/components/ui';
import type { PendingActions } from '@/lib/services/pending-actions';
import { getTotalPendingCount, buildActionChips } from '@/lib/services/pending-actions';

interface ActionStripProps {
  actions: PendingActions;
}

export function ActionStrip({ actions }: ActionStripProps) {
  if (getTotalPendingCount(actions) === 0) return null;

  const { seller, buyer } = buildActionChips(actions);
  const hasBothGroups = seller.length > 0 && buyer.length > 0;

  return (
    <Alert variant="warning" icon={WarningCircle} className="mb-6">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
        {seller.map((chip, i) => (
          <span key={chip.href + chip.label} className="inline-flex items-center">
            {i > 0 && <span className="text-semantic-text-muted mx-1">&middot;</span>}
            <Link
              href={chip.href}
              className="text-semantic-text-secondary sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom underline decoration-semantic-text-muted/30 underline-offset-2"
            >
              {chip.count} {chip.label}
            </Link>
          </span>
        ))}
        {hasBothGroups && (
          <span className="text-semantic-text-muted mx-1">|</span>
        )}
        {buyer.map((chip, i) => (
          <span key={chip.href + chip.label} className="inline-flex items-center">
            {i > 0 && <span className="text-semantic-text-muted mx-1">&middot;</span>}
            <Link
              href={chip.href}
              className="text-semantic-text-secondary sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom underline decoration-semantic-text-muted/30 underline-offset-2"
            >
              {chip.count} {chip.label}
            </Link>
          </span>
        ))}
      </div>
    </Alert>
  );
}
