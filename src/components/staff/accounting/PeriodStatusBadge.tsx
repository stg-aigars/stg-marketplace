import { Badge } from '@/components/ui';
import type { PeriodStatus } from '@/lib/accounting/types';

type PeriodStatusVariant = 'success' | 'warning' | 'error';

const STATUS_CONFIG: Record<PeriodStatus, { variant: PeriodStatusVariant; label: string }> = {
  open: { variant: 'success', label: 'Open' },
  soft_locked: { variant: 'warning', label: 'Soft-locked' },
  hard_locked: { variant: 'error', label: 'Hard-locked' },
};

export function PeriodStatusBadge({ status }: { status: PeriodStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
