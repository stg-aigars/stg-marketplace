'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from '@phosphor-icons/react/ssr';
import { SectionLink } from '@/components/ui';
import { colors } from '@/styles/tokens';

type TabKey = 'browse' | 'sell' | 'ship' | 'payments';

const TAB_CONFIG: Array<{ key: TabKey; color: string; href: string }> = [
  { key: 'browse', color: colors.semantic.primary, href: '/browse' },
  { key: 'sell', color: colors.semantic.brand, href: '/sell' },
  { key: 'ship', color: colors.semantic.success, href: '/help' },
  { key: 'payments', color: colors.aurora.purple, href: '/help' },
];

type FeatureItem = { name: string; detail: string };

function Features() {
  const t = useTranslations('home.features');
  const [activeKey, setActiveKey] = useState<TabKey>('browse');
  const active = TAB_CONFIG.find((c) => c.key === activeKey)!;
  const items = t.raw(`tabs.${activeKey}.items`) as FeatureItem[];

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-semantic-bg-secondary border-y border-semantic-border-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-semantic-text-secondary mb-3">
            {t('eyebrow')}
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold font-display tracking-tight text-semantic-text-heading">
            {t('heading')}
          </h2>
        </div>

        <div className="flex gap-1 overflow-x-auto -mb-px" role="tablist">
          {TAB_CONFIG.map((tab) => {
            const isActive = tab.key === activeKey;
            return (
              <button
                key={tab.key}
                role="tab"
                id={`tab-${tab.key}`}
                aria-selected={isActive}
                aria-controls={`tab-panel-${tab.key}`}
                onClick={() => setActiveKey(tab.key)}
                className={
                  'px-4 sm:px-5 py-3 sm:py-3.5 rounded-t-lg whitespace-nowrap font-medium transition-colors duration-250 ease-out-custom focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus ' +
                  (isActive
                    ? 'text-polar-night font-semibold'
                    : 'text-semantic-text-secondary sm:hover:text-semantic-text-primary')
                }
                style={isActive ? { backgroundColor: tab.color } : undefined}
              >
                {t(`tabs.${tab.key}.label`)}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`tab-panel-${activeKey}`}
          aria-labelledby={`tab-${activeKey}`}
          className="border-2 border-semantic-border-strong rounded-b-lg rounded-tr-lg bg-semantic-bg-elevated p-6 sm:p-10"
          style={{ borderTopWidth: '4px', borderTopColor: active.color }}
        >
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14">
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading mb-4">
                {t(`tabs.${activeKey}.title`)}
              </h3>
              <p className="text-semantic-text-secondary leading-relaxed mb-6">
                {t(`tabs.${activeKey}.body`)}
              </p>
              <SectionLink href={active.href} color={active.color}>
                {t(`tabs.${activeKey}.linkText`)}
              </SectionLink>
            </div>

            <ul className="grid gap-4">
              {items.map((item, idx) => (
                <li key={idx} className="grid grid-cols-[28px_1fr] gap-3 items-start">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md border-2 border-polar-night text-polar-night shrink-0"
                    style={{ backgroundColor: active.color }}
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
