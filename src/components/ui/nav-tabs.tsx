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
  /** When true, render a small warning-toned dot next to the label so the
   *  tab announces an action-needed cohort without forcing staff to click
   *  through to find out. Use sparingly — only for tabs whose underlying
   *  view has time-sensitive items (stuck orders, escalated disputes,
   *  open DSA notices). */
  attention?: boolean;
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
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors duration-250 ease-out-custom',
                active
                  ? 'bg-semantic-brand text-semantic-text-inverse border-semantic-brand'
                  : 'border-semantic-border-subtle text-semantic-text-secondary sm:hover:bg-semantic-bg-subtle',
              )}
            >
              {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
              {tab.attention && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-semantic-warning shrink-0"
                  aria-label="Action needed"
                />
              )}
            </Link>
          );
        })}
      </div>
    );
  }

  // CSS mask gives us a right-edge fade independent of the parent
  // background colour — useful here because NavTabs is used in places
  // with different backgrounds (staff layout's frost-ice tint, plain
  // white pages, etc.) and a colour-matched gradient overlay would have
  // to be parameterised. The mask is mobile-only via the `sm:` breakpoint
  // so desktop (where overflow is rare) doesn't get a vestigial fade.
  const maskGradient = 'linear-gradient(to right, black 0, black calc(100% - 32px), transparent 100%)';

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
      style={{
        maskImage: maskGradient,
        WebkitMaskImage: maskGradient,
      }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-250 ease-out-custom relative sm:hover:text-semantic-text-secondary',
              active ? 'text-semantic-brand' : 'text-semantic-text-muted',
            )}
          >
            <span>
              {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
            </span>
            {tab.attention && (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-semantic-warning shrink-0"
                aria-label="Action needed"
              />
            )}
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
