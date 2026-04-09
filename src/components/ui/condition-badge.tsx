import { Badge } from './badge';
import type { HTMLAttributes } from 'react';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';
import { conditionConfig } from '@/lib/condition-config';

interface ConditionBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  condition: ListingCondition;
}

function ConditionBadge({ condition, ...props }: ConditionBadgeProps) {
  const badgeKey = conditionToBadgeKey[condition];
  return (
    <Badge condition={badgeKey} {...props}>
      {conditionConfig[badgeKey].label}
    </Badge>
  );
}

export { ConditionBadge };
export type { ConditionBadgeProps };
