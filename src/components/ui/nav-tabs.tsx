'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { stripLocalePrefix } from '@/lib/locale-utils';
import { cn } from '@/lib/cn';

interface NavTabItem {
  key: string;
  label: string;
  href: string;
  count?: number;
}

interface NavTabsProps {
  tabs: NavTabItem[];
  /** If provided, overrides auto-detection from pathname */
  activeTab?: string;
  variant?: 'underline' | 'pill';
  className?: string;
}

function NavTabs({ tabs, activeTab, variant = 'underline', className }: NavTabsProps) {
  const pathname = usePathname();

  // Active tab: explicit prop wins. Otherwise pick the tab whose href is the
  // longest prefix of the current path. The longest-prefix rule is what
  // prevents a parent route (e.g. `/staff`) from appearing active for every
  // `/staff/*` child — `/staff/orders` matches both `/staff/orders` and
  // `/staff` under naive startsWith, but the longer href wins.
  let activeKey: string | undefined = activeTab;
  if (activeKey === undefined) {
    const cleanPath = stripLocalePrefix(pathname);
    let bestMatch: NavTabItem | null = null;
    for (const tab of tabs) {
      const matches =
        cleanPath === tab.href ||
        (tab.href !== '/' && cleanPath.startsWith(tab.href + '/'));
      if (matches && (!bestMatch || tab.href.length > bestMatch.href.length)) {
        bestMatch = tab;
      }
    }
    activeKey = bestMatch?.key;
  }

  const isActive = (tab: NavTabItem) => tab.key === activeKey;

  if (variant === 'pill') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg border transition-colors duration-250 ease-out-custom',
                active
                  ? 'bg-semantic-brand text-semantic-text-inverse border-semantic-brand'
                  : 'border-semantic-border-subtle text-semantic-text-secondary sm:hover:bg-semantic-bg-subtle',
              )}
            >
              {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <nav
      aria-label="Navigation"
      className={cn(
        // overflow-x-auto matches the homepage Features-tabs pattern so a
        // long tab strip (e.g. the staff dashboard) scrolls horizontally
        // on narrow viewports rather than overflowing the layout.
        'flex gap-1 border-b border-semantic-border-subtle overflow-x-auto -mb-px',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-250 ease-out-custom relative sm:hover:text-semantic-text-secondary',
              active ? 'text-semantic-brand' : 'text-semantic-text-muted',
            )}
          >
            {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
            {active && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-semantic-brand" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export { NavTabs };
export type { NavTabsProps, NavTabItem };
