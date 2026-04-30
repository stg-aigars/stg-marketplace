'use client';

import type { ReactNode } from 'react';
import { X } from '@phosphor-icons/react/ssr';
import { cn } from '@/lib/cn';

interface AlertProps {
  variant: 'error' | 'success' | 'warning' | 'info';
  children: ReactNode;
  /** Already-rendered icon element (e.g. `<Warning size={20} />`). Pass an
   *  element rather than a component because Alert is a Client Component
   *  and the Phosphor `/ssr` icons are forwardRef components — passing the
   *  raw component type from a Server Component crashes the RSC boundary
   *  with "Functions cannot be passed directly to Client Components".
   *  Rendering server-side yields a React element that traverses cleanly. */
  icon?: ReactNode;
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const variantClasses: Record<AlertProps['variant'], string> = {
  error: 'bg-semantic-error/10 border-semantic-error/30 text-semantic-error',
  success: 'bg-semantic-success/10 border-semantic-success/30 text-semantic-text-primary',
  warning: 'bg-semantic-warning/10 border-semantic-warning/30 text-semantic-text-primary',
  info: 'bg-semantic-brand/10 border-semantic-brand/30 text-semantic-text-primary',
};

export function Alert({ variant, children, icon, title, dismissible, onDismiss, className }: AlertProps) {
  const content = icon || title ? (
    <div className="flex gap-3">
      {icon && (
        <div className="shrink-0 mt-0.5">{icon}</div>
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
      className={cn('rounded-lg border p-4 sm:p-5 text-sm', variantClasses[variant], className)}
    >
      {dismissible ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">{content}</div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 p-1 text-current opacity-60 sm:hover:opacity-100 transition-opacity duration-250 ease-out-custom"
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
