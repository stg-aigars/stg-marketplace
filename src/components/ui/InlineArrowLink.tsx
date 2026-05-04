import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/ssr';
import { cn } from '@/lib/cn';

interface InlineArrowLinkProps {
  href: string;
  children: React.ReactNode;
  /** sm = 12px arrow + text-xs (dense rows like the listing condition row).
   *  md = 14px arrow + text-sm (default; FAQ panels, modal CTAs). */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Inline link with a trailing right-arrow. Use for "navigate elsewhere"
 * affordances inside prose or content rows. For section-heading neighbours
 * ("Browse all", "Read more"), use `SectionLink` instead — same idiom,
 * different layout role.
 */
function InlineArrowLink({ href, children, size = 'md', className }: InlineArrowLinkProps) {
  const text = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 12 : 14;
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold text-semantic-brand sm:hover:opacity-70 transition-opacity duration-250 ease-out-custom',
        text,
        className,
      )}
    >
      {children}
      <ArrowRight size={iconSize} weight="bold" />
    </Link>
  );
}

export { InlineArrowLink };
export type { InlineArrowLinkProps };
