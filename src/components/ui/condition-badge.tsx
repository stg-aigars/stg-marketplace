import { Badge } from './badge';
import type { HTMLAttributes } from 'react';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';
import { getConditionLabel } from '@/lib/condition-config';

interface ConditionBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  condition: ListingCondition;
}

function ConditionBadge({ condition, ...props }: ConditionBadgeProps) {
  return (
    <Badge condition={conditionToBadgeKey[condition]} {...props}>
      {getConditionLabel(condition)}
    </Badge>
  );
}

export { ConditionBadge };
export type { ConditionBadgeProps };
