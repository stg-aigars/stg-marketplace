import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={`mb-4 text-sm text-semantic-text-muted flex items-center min-w-0 ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={index} className="flex items-center min-w-0">
            {index > 0 && <span className="mx-2 shrink-0" aria-hidden="true">/</span>}
            {isLast || !item.href ? (
              <span
                className={`text-semantic-text-secondary ${isLast ? 'truncate' : 'shrink-0'}`}
                {...(isLast ? { 'aria-current': 'page' as const } : {})}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className={`sm:hover:text-semantic-text-secondary transition-colors ${
                  index === items.length - 2 && items.length > 2 ? 'truncate' : 'shrink-0'
                }`}
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
