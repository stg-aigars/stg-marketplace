import type { ComponentType } from 'react';
import Link from 'next/link';
import { Button } from './button';

interface EmptyStateLinkAction {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
}

interface EmptyStateButtonAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

type EmptyStateAction = EmptyStateLinkAction | EmptyStateButtonAction;

interface EmptyStateProps {
  icon?: ComponentType<{ size?: number | string; className?: string }>;
  title?: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-16 ${className}`}>
      {Icon && (
        <Icon size={64} className="mx-auto text-semantic-text-muted mb-4" />
      )}
      {title && (
        <p className="text-semantic-text-secondary text-lg">{title}</p>
      )}
      {description && (
        <p className="text-semantic-text-muted mt-1">{description}</p>
      )}
      {action && 'href' in action && (
        <Link href={action.href} className="inline-block mt-4">
          <Button variant={action.variant ?? 'primary'}>{action.label}</Button>
        </Link>
      )}
      {action && 'onClick' in action && (
        <div className="mt-4">
          <Button variant={action.variant ?? 'primary'} onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
