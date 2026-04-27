import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/ssr';
import { cn } from '@/lib/cn';

interface SectionLinkProps {
  href: string;
  children: React.ReactNode;
  /** Override the default brand teal — use for contextual coloring (e.g. tab accent panels) */
  color?: string;
  className?: string;
}

/**
 * Standard "section navigation" link — text + right arrow.
 * Use next to section headings ("Browse all", "Read more", etc.) to lead users
 * to the full surface. Brand teal by default; pass `color` to override for
 * contextual surfaces like tab panels with their own accent.
 */
function SectionLink({ href, children, color, className }: SectionLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity duration-250 ease-out-custom sm:hover:opacity-70',
        !color && 'text-semantic-brand',
        className,
      )}
      style={color ? { color } : undefined}
    >
      {children}
      <ArrowRight size={14} weight="bold" />
    </Link>
  );
}

export { SectionLink };
export type { SectionLinkProps };
