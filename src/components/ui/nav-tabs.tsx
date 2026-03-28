'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { routing } from '@/i18n/routing';

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

function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/');
  if (segments.length > 1 && routing.locales.includes(segments[1] as (typeof routing.locales)[number])) {
    return '/' + segments.slice(2).join('/') || '/';
  }
  return pathname;
}

function NavTabs({ tabs, activeTab, variant = 'underline', className = '' }: NavTabsProps) {
  const pathname = usePathname();

  const isActive = (tab: NavTabItem) => {
    if (activeTab !== undefined) return tab.key === activeTab;
    const cleanPath = stripLocalePrefix(pathname);
    return cleanPath === tab.href || (tab.href !== '/' && cleanPath.startsWith(tab.href + '/'));
  };

  if (variant === 'pill') {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                active
                  ? 'bg-semantic-brand text-semantic-text-inverse border-semantic-brand'
                  : 'border-semantic-border-subtle text-semantic-text-secondary sm:hover:bg-semantic-bg-subtle'
              }`}
            >
              {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <nav aria-label="Navigation" className={`flex gap-1 border-b border-semantic-border-subtle ${className}`}>
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`px-4 py-2 text-sm font-medium transition-colors relative sm:hover:text-semantic-text-secondary ${
              active
                ? 'text-semantic-brand'
                : 'text-semantic-text-muted'
            }`}
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
