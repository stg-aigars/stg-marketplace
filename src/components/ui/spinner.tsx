import { CircleNotch } from '@phosphor-icons/react/ssr';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

const sizeMap: Record<SpinnerSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <CircleNotch
      size={sizeMap[size]}
      className={`animate-spin ${className}`}
    />
  );
}

export { Spinner };
export type { SpinnerProps };
