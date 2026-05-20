'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { stripLocalePrefix } from '@/lib/locale-utils';
import { cn } from '@/lib/cn';
import { CountBadge } from '@/components/ui';
import { STAFF_NAV_GROUPS, findActiveKey } from './staff-nav-data';

function StaffSideNav() {
  const pathname = usePathname();
  const activeKey = findActiveKey(stripLocalePrefix(pathname));

  return (
    <nav
      aria-label="Staff navigation"
      className="hidden lg:block sticky top-24 w-56 shrink-0 self-start max-h-[calc(100vh-7rem)] overflow-y-auto text-sm"
    >
      {STAFF_NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-4">
          <p className="text-xs font-semibold text-semantic-text-muted uppercase tracking-wider mb-1.5">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.key === activeKey;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between gap-2 px-2 py-1 rounded transition-colors duration-250 ease-out-custom',
                      active
                        ? 'text-semantic-brand font-medium bg-semantic-brand/10'
                        : 'text-semantic-text-secondary sm:hover:text-semantic-text-primary sm:hover:bg-semantic-bg-subtle',
                    )}
                  >
                    <span>{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <CountBadge count={item.count} />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export { StaffSideNav };
