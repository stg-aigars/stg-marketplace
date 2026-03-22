'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

function NavTabs({ tabs, activeTab, variant = 'underline', className = '' }: NavTabsProps) {
  const pathname = usePathname();

  const isActive = (tab: NavTabItem) => {
    if (activeTab !== undefined) return tab.key === activeTab;
    // Auto-detect: exact match or starts with href (for nested routes)
    // Strip locale prefix for matching
    const cleanPath = pathname.replace(/^\/[a-z]{2}(?=\/)/, '');
    return cleanPath === tab.href || (tab.href !== '/' && cleanPath.startsWith(tab.href + '/'));
  };

  if (variant === 'pill') {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`} role="tablist">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              role="tab"
              aria-selected={active}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                active
                  ? 'bg-semantic-primary text-semantic-text-inverse border-semantic-primary'
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
    <nav className={`flex gap-1 border-b border-semantic-border-subtle ${className}`} role="tablist">
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-lg sm:hover:bg-semantic-bg-subtle ${
              active
                ? 'text-semantic-primary'
                : 'text-semantic-text-secondary'
            }`}
          >
            {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
          </Link>
        );
      })}
    </nav>
  );
}

export { NavTabs };
export type { NavTabsProps, NavTabItem };
