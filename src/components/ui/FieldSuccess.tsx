import type { ReactNode } from 'react';
import { CheckCircle } from '@phosphor-icons/react/ssr';
import { cn } from '@/lib/cn';

interface FieldSuccessProps {
  children: ReactNode;
  className?: string;
}

export function FieldSuccess({ children, className }: FieldSuccessProps) {
  return (
    <p
      className={cn(
        'mt-1.5 flex items-center gap-1.5 text-sm text-semantic-success',
        className
      )}
    >
      <CheckCircle size={16} weight="fill" aria-hidden="true" />
      {children}
    </p>
  );
}
