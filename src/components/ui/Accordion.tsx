'use client';

import { useId, useState, type ReactNode } from 'react';
import { Plus } from '@phosphor-icons/react/ssr';
import { cn } from '@/lib/cn';

export type AccordionItem = {
  q: ReactNode;
  a: ReactNode;
};

export type AccordionProps = {
  items: AccordionItem[];
  /**
   * If true, opening one item closes the previously open one.
   * Default false — multiple items can stay open. Use `true` for marketing-style FAQs
   * where one-at-a-time scanning is preferred.
   */
  exclusive?: boolean;
  /** Outer top/bottom borders. Default true; pass false when the accordion lives
   *  inside a Card so only the inter-item dividers remain. */
  bordered?: boolean;
  /** Question-button text size. `md` (default) — `text-base sm:text-lg`,
   *  the standard accordion question size. `lg` — `text-lg sm:text-xl`, for
   *  marketing-style FAQs where the question text is the dominant element. */
  size?: 'md' | 'lg';
  /** Surfaced as aria-label on the wrapper. Required-in-spirit when multiple
   *  Accordions are on the same page. */
  ariaLabel?: string;
  className?: string;
};

function Accordion({
  items,
  exclusive = false,
  bordered = true,
  size = 'md',
  ariaLabel,
  className,
}: AccordionProps) {
  const buttonSizeClass = size === 'lg' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg';
  const baseId = useId();
  const [open, setOpen] = useState<Set<number>>(() => new Set());

  const toggle = (index: number) => {
    setOpen((prev) => {
      const next = new Set(exclusive ? [] : prev);
      if (prev.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'divide-y divide-semantic-border-strong',
        bordered && 'border-t border-b border-semantic-border-strong',
        className,
      )}
    >
      {items.map((item, index) => {
        const isOpen = open.has(index);
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
                onClick={() => toggle(index)}
                className={cn(
                  'flex items-center justify-between w-full py-5 text-left font-medium text-semantic-text-heading transition-colors duration-250 ease-out-custom sm:hover:text-semantic-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus focus-visible:ring-offset-2 rounded-sm',
                  buttonSizeClass,
                )}
              >
                <span>{item.q}</span>
                <Plus
                  size={24}
                  weight="bold"
                  className={cn(
                    'shrink-0 ml-4 text-semantic-text-secondary transition-transform duration-250 ease-out-custom',
                    isOpen && 'rotate-45',
                  )}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="pb-5 pr-10 text-semantic-text-secondary leading-relaxed space-y-3"
            >
              {item.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { Accordion };
