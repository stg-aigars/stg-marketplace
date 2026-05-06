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
  /**
   * Whether to draw outer top and bottom borders that frame the accordion as a
   * standalone block. Default true (the framed look used on a plain page). Pass
   * false when the accordion already lives inside a bordered container — e.g. a
   * Card — so the inter-item dividers do the visual work without the
   * frame-within-a-frame heaviness.
   */
  bordered?: boolean;
  /**
   * Optional label for the entire group, surfaced via aria-label on the wrapper.
   * Useful when there are multiple Accordions on a page (e.g. one per Help section)
   * so screen readers can distinguish them.
   */
  ariaLabel?: string;
  className?: string;
};

function Accordion({
  items,
  exclusive = false,
  bordered = true,
  ariaLabel,
  className,
}: AccordionProps) {
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
      role="region"
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
                className="flex items-center justify-between w-full py-5 text-left text-base sm:text-lg font-medium text-semantic-text-heading transition-colors duration-250 ease-out-custom sm:hover:text-semantic-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus focus-visible:ring-offset-2 rounded-sm"
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
