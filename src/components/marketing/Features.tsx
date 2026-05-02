'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from '@phosphor-icons/react/ssr';
import { SectionLink } from '@/components/ui';
import { colors } from '@/styles/tokens';

type TabKey = 'browse' | 'sell' | 'ship' | 'payments';

const TAB_KEYS: readonly TabKey[] = ['payments', 'ship', 'sell', 'browse'];

const TAB_COLORS: Record<TabKey, string> = {
  browse: colors.semantic.primary,
  sell: colors.semantic.brand,
  ship: colors.semantic.success,
  payments: colors.aurora.purple,
};

type FeatureItem = { name: string; detail: string };
type FeatureLink = { text: string; href: string };

function Features() {
  const t = useTranslations('home.features');
  const [activeKey, setActiveKey] = useState<TabKey>('payments');
  const activeColor = TAB_COLORS[activeKey];
  // useMemo so t.raw doesn't return new array refs on every render and
  // bust child memoization downstream.
  const items = useMemo(() => t.raw(`tabs.${activeKey}.items`) as FeatureItem[], [t, activeKey]);
  const links = useMemo(() => t.raw(`tabs.${activeKey}.links`) as FeatureLink[], [t, activeKey]);
  const subhead = t.has(`tabs.${activeKey}.subhead`) ? t(`tabs.${activeKey}.subhead`) : null;

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-semantic-bg-secondary border-y border-semantic-border-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-semantic-text-secondary mb-3">
            {t('eyebrow')}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-semantic-text-heading">
            {t('heading')}
          </h2>
        </div>

        <div className="flex gap-1 overflow-x-auto -mb-px" role="tablist">
          {TAB_KEYS.map((key) => {
            const isActive = key === activeKey;
            return (
              <button
                key={key}
                role="tab"
                id={`tab-${key}`}
                aria-selected={isActive}
                aria-controls={`tab-panel-${key}`}
                onClick={() => setActiveKey(key)}
                className={
                  'px-4 sm:px-5 py-3 sm:py-3.5 rounded-t-lg whitespace-nowrap font-medium transition-colors duration-250 ease-out-custom focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus ' +
                  (isActive
                    ? 'text-polar-night font-semibold'
                    : 'text-semantic-text-secondary sm:hover:text-semantic-text-primary')
                }
                style={isActive ? { backgroundColor: TAB_COLORS[key] } : undefined}
              >
                {t(`tabs.${key}.label`)}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`tab-panel-${activeKey}`}
          aria-labelledby={`tab-${activeKey}`}
          className="border-2 border-semantic-border-strong rounded-b-lg rounded-tr-lg bg-semantic-bg-elevated p-6 sm:p-10"
          style={{ borderTopWidth: '4px', borderTopColor: activeColor }}
        >
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading mb-4">
                {t(`tabs.${activeKey}.title`)}
              </h3>
              {subhead ? (
                <p className="text-sm text-semantic-text-muted font-medium mt-1 mb-4">
                  {subhead}
                </p>
              ) : null}
              <p className="text-semantic-text-secondary leading-relaxed mb-6">
                {t(`tabs.${activeKey}.body`)}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {links.map((link) => (
                  <SectionLink key={link.href} href={link.href} color={activeColor}>
                    {link.text}
                  </SectionLink>
                ))}
              </div>
            </div>

            <ul className="grid gap-4">
              {items.map((item, idx) => (
                <li key={idx} className="grid grid-cols-[28px_1fr] gap-3 items-start">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md border-2 border-polar-night text-polar-night shrink-0"
                    style={{ backgroundColor: activeColor }}
                  >
                    <Check size={16} weight="bold" />
                  </span>
                  <span>
                    <span className="block font-semibold text-semantic-text-primary">
                      {item.name}
                    </span>
                    <span className="block text-sm text-semantic-text-secondary leading-relaxed">
                      {item.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export { Features };
