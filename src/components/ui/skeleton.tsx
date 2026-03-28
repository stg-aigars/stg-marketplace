import { type HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-semantic-bg-secondary ${className}`}
      {...props}
    />
  );
}

export { Skeleton };
export type { SkeletonProps };
