import { type HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-snow-storm-light ${className}`}
      {...props}
    />
  );
}

export { Skeleton };
export type { SkeletonProps };
