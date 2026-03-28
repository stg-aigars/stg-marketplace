interface GameTitleProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  serif?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'text-[11px] leading-tight',
  sm: 'text-xs leading-tight',
  md: 'text-sm leading-tight',
  lg: 'text-base leading-tight',
} as const;

function GameTitle({ name, size = 'md', serif = true, className = '' }: GameTitleProps) {
  return (
    <span
      className={`${sizeClasses[size]} font-semibold text-semantic-text-heading truncate block ${
        serif ? 'font-display tracking-tight' : 'font-sans'
      } ${className}`}
    >
      {name}
    </span>
  );
}

export { GameTitle };
export type { GameTitleProps };
