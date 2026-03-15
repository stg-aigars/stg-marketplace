import { type HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'trust';
type ConditionKey = 'likeNew' | 'veryGood' | 'good' | 'acceptable' | 'forParts';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  condition?: ConditionKey;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-snow-storm-light text-semantic-text-secondary border-snow-storm',
  success: 'bg-condition-like-new-bg text-condition-like-new-text border-condition-like-new',
  warning: 'bg-condition-good-bg text-condition-good-text border-condition-good',
  error: 'bg-condition-for-parts-bg text-condition-for-parts-text border-condition-for-parts',
  trust: 'bg-frost-ice/10 text-frost-arctic border-frost-ice',
};

const conditionClasses: Record<ConditionKey, string> = {
  likeNew: 'bg-condition-like-new-bg text-condition-like-new-text border-condition-like-new',
  veryGood: 'bg-condition-very-good-bg text-condition-very-good-text border-condition-very-good',
  good: 'bg-condition-good-bg text-condition-good-text border-condition-good',
  acceptable: 'bg-condition-acceptable-bg text-condition-acceptable-text border-condition-acceptable',
  forParts: 'bg-condition-for-parts-bg text-condition-for-parts-text border-condition-for-parts',
};

function Badge({ variant = 'default', condition, className = '', children, ...props }: BadgeProps) {
  const classes = condition ? conditionClasses[condition] : variantClasses[variant];

  return (
    <span
      className={`inline-flex items-center rounded-2xl border px-2.5 py-1 text-xs font-medium ${classes} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeProps, ConditionKey };
