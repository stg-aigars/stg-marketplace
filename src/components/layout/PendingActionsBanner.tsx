'use client';

import Link from 'next/link';
import { X } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';
import { usePendingActions } from '@/hooks/usePendingActions';
import { buildActionChips } from '@/lib/pending-actions/types';

export function PendingActionsBanner() {
  const { actions, total, dismissed, dismiss } = usePendingActions();

  if (!actions || total === 0 || dismissed) return null;

  const { seller, buyer } = buildActionChips(actions);
  const hasBothGroups = seller.length > 0 && buyer.length > 0;

  return (
    <div className="bg-semantic-warning-bg border-b border-semantic-warning/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2 text-sm">
        <span className="font-medium text-semantic-text-heading shrink-0">Needs attention:</span>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 flex-1 min-w-0">
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
        <Button
          variant="ghost"
          size="sm"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 !p-1"
        >
          <X size={16} weight="bold" />
        </Button>
      </div>
    </div>
  );
}
