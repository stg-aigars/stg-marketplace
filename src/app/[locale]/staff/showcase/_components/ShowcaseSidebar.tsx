'use client';

import { useEffect, useState, useCallback } from 'react';
import { SIDEBAR_SECTIONS } from './mock-data';

export function ShowcaseSidebar() {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const headings = document.querySelectorAll<HTMLElement>('[data-showcase-heading]');
    if (!headings.length) return;

    // Observe headings, not full sections — avoids multi-active with varying heights
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-showcase-heading');
            if (id) setActiveId(id);
          }
        }
      },
      {
        // Top offset for sticky nav + staff tabs; bottom bias toward viewport top
        rootMargin: '-96px 0px -70% 0px',
      }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const allItems = SIDEBAR_SECTIONS.flatMap((s) => s.items);

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:block sticky top-24 w-48 shrink-0 self-start max-h-[calc(100vh-8rem)] overflow-y-auto text-sm">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.group} className="mb-4">
            <p className="text-xs font-semibold text-semantic-text-muted uppercase tracking-wider mb-1.5">
              {section.group}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => scrollTo(item.id)}
                    className={`block w-full text-left px-2 py-1 rounded transition-colors duration-250 ease-out-custom ${
                      activeId === item.id
                        ? 'text-semantic-brand font-medium bg-semantic-brand/10'
                        : 'text-semantic-text-secondary sm:hover:text-semantic-text-primary sm:hover:bg-semantic-bg-subtle'
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Mobile jump-to dropdown */}
      <div className="lg:hidden fixed bottom-4 right-4 z-30">
        <select
          aria-label="Jump to component"
          onChange={(e) => {
            if (e.target.value) scrollTo(e.target.value);
            e.target.value = ''; // reset so same section can be re-selected
          }}
          defaultValue=""
          className="rounded-lg border border-semantic-border-default bg-semantic-bg-elevated shadow-lg px-3 py-2 text-sm text-semantic-text-primary"
        >
          <option value="" disabled>Jump to...</option>
          {allItems.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </div>
    </>
  );
}
