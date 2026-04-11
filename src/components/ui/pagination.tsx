import Link from 'next/link';
import { Button } from './button';
import { cn } from '@/lib/cn';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  buildUrl: (page: number) => string;
  className?: string;
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (current > 3) {
    pages.push('ellipsis');
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push('ellipsis');
  }

  pages.push(total);

  return pages;
}

function Pagination({ currentPage, totalPages, totalItems, pageSize, buildUrl, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const showingFrom = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingTo = Math.min(currentPage * pageSize, totalItems);
  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-between mt-8', className)}>
      <p className="text-sm text-semantic-text-secondary">
        Showing {showingFrom}–{showingTo} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        {currentPage > 1 ? (
          <Button variant="secondary" size="sm" asChild>
            <Link href={buildUrl(currentPage - 1)}>Previous</Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled>Previous</Button>
        )}

        <div className="hidden sm:flex items-center gap-1 mx-2">
          {pages.map((page, index) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className="px-2 text-semantic-text-muted" aria-hidden="true">...</span>
            ) : page === currentPage ? (
              <Button
                key={page}
                variant="primary"
                size="sm"
                className="min-w-[44px]"
                aria-current="page"
                disabled
              >
                {page}
              </Button>
            ) : (
              <Button
                key={page}
                variant="ghost"
                size="sm"
                className="min-w-[44px]"
                asChild
              >
                <Link href={buildUrl(page)}>{page}</Link>
              </Button>
            )
          )}
        </div>

        <span className="sm:hidden text-sm text-semantic-text-muted mx-2">
          {currentPage} / {totalPages}
        </span>

        {currentPage < totalPages ? (
          <Button variant="secondary" size="sm" asChild>
            <Link href={buildUrl(currentPage + 1)}>Next</Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled>Next</Button>
        )}
      </div>
    </nav>
  );
}

export { Pagination };
export type { PaginationProps };
