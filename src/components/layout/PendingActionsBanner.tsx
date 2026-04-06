'use client';

import { X } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';
import { ActionChipList } from '@/components/ActionChipList';
import { usePendingActions } from '@/hooks/usePendingActions';
import { buildActionChips } from '@/lib/pending-actions/types';

export function PendingActionsBanner() {
  const { actions, total, dismissed, dismiss } = usePendingActions();

  if (!actions || total === 0 || dismissed) return null;

  const { seller, buyer } = buildActionChips(actions);

  return (
    <div className="bg-semantic-primary-bg border-b border-semantic-primary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2">
        <span className="font-medium text-sm text-semantic-text-heading shrink-0">Needs attention:</span>
        <div className="flex-1 min-w-0">
          <ActionChipList seller={seller} buyer={buyer} />
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
