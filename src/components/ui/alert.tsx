'use client';

import type { ComponentType, ReactNode } from 'react';
import { X } from '@phosphor-icons/react/ssr';

interface AlertProps {
  variant: 'error' | 'success' | 'warning' | 'info';
  children: ReactNode;
  icon?: ComponentType<{ size?: number | string; className?: string }>;
  title?: string;
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

export function Alert({ variant, children, icon: Icon, title, dismissible, onDismiss, className = '' }: AlertProps) {
  const content = Icon || title ? (
    <div className="flex gap-3">
      {Icon && (
        <div className="shrink-0 mt-0.5">
          <Icon size={20} />
        </div>
      )}
      <div className="min-w-0">
        {title && (
          <p className="font-medium text-sm">{title}</p>
        )}
        <div className={title ? 'mt-1' : ''}>{children}</div>
      </div>
    </div>
  ) : (
    children
  );

  return (
    <div
      role="alert"
      className={`rounded-lg border p-4 sm:p-5 text-sm ${variantClasses[variant]} ${className}`}
    >
      {dismissible ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">{content}</div>
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
        content
      )}
    </div>
  );
}
