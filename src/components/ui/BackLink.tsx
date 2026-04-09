import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/ssr';

interface BackLinkProps {
  href: string;
  label: string;
  className?: string;
}

export function BackLink({ href, label, className = 'mb-4' }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-sm text-semantic-text-muted sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom ${className}`}
    >
      <ArrowLeft size={14} />
      {label}
    </Link>
  );
}
