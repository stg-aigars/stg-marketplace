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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon?: ComponentType<any>;
  title?: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: { label: string; href: string };
  className?: string;
}

function EmptyState({ icon: Icon, title, description, action, secondaryAction, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-16 ${className}`}>
      {Icon && (
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl border-[1.5px] border-dashed border-semantic-border-default mb-4">
          <Icon size={36} className="text-semantic-brand" weight="regular" />
        </div>
      )}
      {title && (
        <p className="text-semantic-text-secondary text-lg font-display tracking-tight font-semibold">{title}</p>
      )}
      {description && (
        <p className="text-semantic-text-muted mt-1">{description}</p>
      )}
      {action && 'href' in action && (
        <Button variant={action.variant ?? 'primary'} asChild>
          <Link href={action.href} className="inline-block mt-4">{action.label}</Link>
        </Button>
      )}
      {action && 'onClick' in action && (
        <div className="mt-4">
          <Button variant={action.variant ?? 'primary'} onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
      {secondaryAction && (
        <Link
          href={secondaryAction.href}
          className="block mt-2 text-sm text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom"
        >
          {secondaryAction.label}
        </Link>
      )}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };
