'use client';

import { useState, useId } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from '@phosphor-icons/react/ssr';

type FaqItem = { q: string; a: string };

function FaqAccordion() {
  const t = useTranslations('home.faq');
  // next-intl's t.raw returns the raw JSON value at the key path.
  const items = t.raw('items') as FaqItem[];
  const [openIndex, setOpenIndex] = useState(-1);
  const baseId = useId();

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-semantic-bg-subtle border-t border-semantic-border-subtle">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-xs font-medium uppercase tracking-wider text-semantic-text-secondary mb-3">
              {t('eyebrow')}
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-semantic-text-heading">
              {t('heading')}
            </h2>
          </div>

          <div className="divide-y divide-semantic-border-strong border-t border-b border-semantic-border-strong">
            {items.map((item, index) => {
              const isOpen = openIndex === index;
              const buttonId = `${baseId}-q-${index}`;
              const panelId = `${baseId}-a-${index}`;
              return (
                <div key={index}>
                  <h3>
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenIndex(isOpen ? -1 : index)}
                      className="flex items-center justify-between w-full py-5 text-left text-lg sm:text-xl font-medium text-semantic-text-heading transition-colors duration-250 ease-out-custom sm:hover:text-semantic-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus focus-visible:ring-offset-2 rounded-sm"
                    >
                      <span>{item.q}</span>
                      <Plus
                        size={24}
                        weight="bold"
                        className={
                          'shrink-0 ml-4 text-semantic-text-secondary transition-transform duration-250 ease-out-custom ' +
                          (isOpen ? 'rotate-45' : '')
                        }
                      />
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    hidden={!isOpen}
                    className="pb-5 pr-10 text-semantic-text-secondary leading-relaxed"
                  >
                    {item.a}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export { FaqAccordion };
