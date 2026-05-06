'use client';

import { useTranslations } from 'next-intl';
import { Accordion, InlineArrowLink, type AccordionItem } from '@/components/ui';

type FaqItem = { q: string; a: string; linkLabel?: string; linkHref?: string };

function FaqAccordion() {
  const t = useTranslations('home.faq');
  const heading = t('heading');
  // next-intl's t.raw returns the raw JSON value at the key path.
  const rawItems = t.raw('items') as FaqItem[];

  const accordionItems: AccordionItem[] = rawItems.map((item) => ({
    q: item.q,
    a: (
      <>
        {item.a}
        {item.linkLabel && item.linkHref && (
          <div className="mt-3">
            <InlineArrowLink href={item.linkHref}>{item.linkLabel}</InlineArrowLink>
          </div>
        )}
      </>
    ),
  }));

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-semantic-bg-subtle border-t border-semantic-border-subtle">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-xs font-medium uppercase tracking-wider text-semantic-text-secondary mb-3">
              {t('eyebrow')}
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-semantic-text-heading">
              {heading}
            </h2>
          </div>

          <Accordion items={accordionItems} exclusive size="lg" ariaLabel={heading} />
        </div>
      </div>
    </section>
  );
}

export { FaqAccordion };
