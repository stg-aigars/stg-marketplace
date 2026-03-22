'use client';

import type { ReactNode } from 'react';
import { X } from '@phosphor-icons/react/ssr';

interface AlertProps {
  variant: 'error' | 'success' | 'warning' | 'info';
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const variantClasses: Record<AlertProps['variant'], string> = {
  error: 'bg-semantic-error/10 border-semantic-error/30 text-semantic-error',
  success: 'bg-semantic-success/10 border-semantic-success/30 text-semantic-text-primary',
  warning: 'bg-semantic-warning/10 border-semantic-warning/30 text-semantic-text-primary',
  info: 'bg-frost-ice/10 border-frost-ice/30 text-semantic-text-primary',
};

export function Alert({ variant, children, dismissible, onDismiss, className = '' }: AlertProps) {
  return (
    <div
      role="alert"
      className={`rounded-lg border p-4 sm:p-5 text-sm ${variantClasses[variant]} ${className}`}
    >
      {dismissible ? (
        <div className="flex items-start justify-between gap-3">
          <div>{children}</div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 p-1 text-current opacity-60 sm:hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X size={20} />
          </button>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
