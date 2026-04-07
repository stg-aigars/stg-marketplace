import Link from 'next/link';
import { GearSix } from '@phosphor-icons/react/ssr';
import { Avatar } from '@/components/ui';
import { getCountryFlag } from '@/lib/country-utils';

interface AccountHeaderProps {
  fullName: string | null;
  avatarUrl: string | null;
  country: string | null;
}

export function AccountHeader({ fullName, avatarUrl, country }: AccountHeaderProps) {
  const name = fullName || 'User';
  const flagClass = getCountryFlag(country);

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={name} src={avatarUrl} size="md" />
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading truncate">
            {name}
          </h1>
          {flagClass && (
            <span className={`${flagClass} shrink-0`} />
          )}
        </div>
      </div>
      <Link
        href="/account/settings"
        className="shrink-0 p-2 rounded-lg text-semantic-text-muted sm:hover:text-semantic-text-secondary sm:hover:bg-semantic-bg-secondary transition-colors duration-250 ease-out-custom"
        aria-label="Settings"
      >
        <GearSix size={22} />
      </Link>
    </div>
  );
}
