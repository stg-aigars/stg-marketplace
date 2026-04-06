'use client';

import { WarningCircle } from '@phosphor-icons/react/ssr';
import { Alert } from '@/components/ui';
import { ActionChipList } from '@/components/ActionChipList';
import type { PendingActions } from '@/lib/pending-actions/types';
import { getTotalPendingCount, buildActionChips } from '@/lib/pending-actions/types';

interface ActionStripProps {
  actions: PendingActions;
}

export function ActionStrip({ actions }: ActionStripProps) {
  if (getTotalPendingCount(actions) === 0) return null;

  const { seller, buyer } = buildActionChips(actions);

  return (
    <Alert variant="warning" icon={WarningCircle} className="mb-6">
      <ActionChipList seller={seller} buyer={buyer} />
    </Alert>
  );
}
