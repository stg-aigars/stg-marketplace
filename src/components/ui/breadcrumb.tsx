import Link from 'next/link';
import { cn } from '@/lib/cn';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('mb-4 text-sm text-semantic-text-muted flex items-center min-w-0', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={index} className="flex items-center min-w-0">
            {index > 0 && <span className="mx-2 shrink-0" aria-hidden="true">/</span>}
            {isLast || !item.href ? (
              <span
                className={cn('text-semantic-text-secondary', isLast ? 'truncate' : 'shrink-0')}
                {...(isLast ? { 'aria-current': 'page' as const } : {})}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className={cn(
                  'sm:hover:text-semantic-text-secondary transition-colors duration-250 ease-out-custom',
                  index === items.length - 2 && items.length > 2 ? 'truncate' : 'shrink-0',
                )}
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export { Breadcrumb };
export type { BreadcrumbProps };
