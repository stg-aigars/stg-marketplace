interface GameTitleProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  serif?: boolean;
  /** When set, allows multi-line text clamped to N lines. Without it, single-line truncate. */
  clamp?: 1 | 2 | 3;
  className?: string;
}

const sizeClasses = {
  xs: 'text-[11px] leading-tight',
  sm: 'text-xs leading-tight',
  md: 'text-sm leading-tight',
  lg: 'text-base leading-tight',
} as const;

const clampClasses = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
} as const;

function GameTitle({ name, size = 'md', serif = true, clamp, className = '' }: GameTitleProps) {
  const overflow = clamp ? clampClasses[clamp] : 'truncate';

  return (
    <span
      className={`${sizeClasses[size]} font-semibold text-semantic-text-heading ${overflow} block ${
        serif ? 'font-display tracking-tight' : 'font-sans'
      } ${className}`}
    >
      {name}
    </span>
  );
}

export { GameTitle };
export type { GameTitleProps };
