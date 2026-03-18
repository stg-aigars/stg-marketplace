'use client';

import type { ReactNode } from 'react';

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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
