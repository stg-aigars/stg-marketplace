'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ checked, onChange, children, disabled, className }: CheckboxProps) {
  return (
    <label className={cn('flex items-start gap-3 cursor-pointer', disabled && 'cursor-not-allowed opacity-50', className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-semantic-border-default text-semantic-brand focus:ring-semantic-brand"
      />
      <span className="text-sm text-semantic-text-secondary">{children}</span>
    </label>
  );
}
