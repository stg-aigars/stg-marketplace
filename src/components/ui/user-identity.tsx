import type { ReactNode } from 'react';
import Link from 'next/link';
import { Avatar } from './avatar';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';

interface UserIdentityProps {
  name: string;
  avatarUrl?: string | null;
  country?: string | null;
  size?: 'xs' | 'sm' | 'md';
  href?: string;
  children?: ReactNode;
}

export function UserIdentity({
  name,
  avatarUrl,
  country,
  size = 'sm',
  href,
  children,
}: UserIdentityProps) {
  const flagClass = country ? getCountryFlag(country) : '';

  const nameEl = href ? (
    <Link
      href={href}
      className="text-sm text-semantic-text-primary sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom truncate"
    >
      {name}
    </Link>
  ) : (
    <span className="text-sm text-semantic-text-primary truncate">{name}</span>
  );

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <Avatar name={name} src={avatarUrl} size={size} className="shrink-0" />
      {nameEl}
      {flagClass && (
        <span
          className={`${flagClass} shrink-0`}
          title={getCountryName(country)}
        />
      )}
      {children}
    </span>
  );
}

export type { UserIdentityProps };
