import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-semantic-bg-secondary', className)}
      {...props}
    />
  );
}

export { Skeleton };
export type { SkeletonProps };
