import { type HTMLAttributes } from 'react';
import { Sparkle, Star, Check, Warning, PuzzlePiece } from '@phosphor-icons/react/ssr';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'trust';
type ConditionKey = 'likeNew' | 'veryGood' | 'good' | 'acceptable' | 'forParts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const conditionIcons: Record<ConditionKey, React.FC<any>> = {
  likeNew: Sparkle,
  veryGood: Star,
  good: Check,
  acceptable: Warning,
  forParts: PuzzlePiece,
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  condition?: ConditionKey;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-snow-storm-light text-semantic-text-secondary border-snow-storm',
  success: 'bg-condition-like-new-bg text-condition-like-new-text border-condition-like-new',
  warning: 'bg-condition-good-bg text-condition-good-text border-condition-good',
  error: 'bg-condition-for-parts-bg text-condition-for-parts-text border-condition-for-parts',
  trust: 'bg-semantic-brand/10 text-semantic-brand-active border-semantic-brand',
};

const conditionClasses: Record<ConditionKey, string> = {
  likeNew: 'bg-condition-like-new-bg text-condition-like-new-text border-condition-like-new',
  veryGood: 'bg-condition-very-good-bg text-condition-very-good-text border-condition-very-good',
  good: 'bg-condition-good-bg text-condition-good-text border-condition-good',
  acceptable: 'bg-condition-acceptable-bg text-condition-acceptable-text border-condition-acceptable',
  forParts: 'bg-condition-for-parts-bg text-condition-for-parts-text border-condition-for-parts',
};

function Badge({ variant = 'default', condition, dot, className = '', children, ...props }: BadgeProps) {
  const classes = condition ? conditionClasses[condition] : variantClasses[variant];
  const ConditionIcon = condition ? conditionIcons[condition] : null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border-[1.5px] px-2.5 py-0.5 text-xs font-semibold ${classes} ${className}`}
      {...props}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      )}
      {ConditionIcon && <ConditionIcon size={12} weight="bold" />}
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeProps, ConditionKey };
