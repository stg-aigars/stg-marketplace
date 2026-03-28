'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CaretDown, MagnifyingGlass, Check } from '@phosphor-icons/react/ssr';

interface FilterMultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** When true, renders as a flat list (for mobile modal) instead of dropdown */
  inline?: boolean;
}

function FilterMultiSelect({ label, options, selected, onChange, inline }: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = useCallback(
    (option: string) => {
      onChange(
        selected.includes(option)
          ? selected.filter((s) => s !== option)
          : [...selected, option]
      );
    },
    [selected, onChange]
  );

  // Close dropdown on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const optionList = (
    <>
      {options.length > 8 && (
        <div className="p-2 border-b border-semantic-border-subtle">
          <div className="relative">
            <MagnifyingGlass
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-semantic-text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-semantic-border-default bg-semantic-bg-elevated text-semantic-text-primary placeholder:text-semantic-text-muted focus:outline-none focus:border-semantic-border-focus"
            />
          </div>
        </div>
      )}
      <div className={inline ? 'space-y-0.5' : 'max-h-48 overflow-y-auto p-1'}>
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-sm text-semantic-text-muted">No matches</p>
        ) : (
          filtered.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggle(option)}
                className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm rounded-md min-h-[36px] transition-colors ${
                  isSelected
                    ? 'text-semantic-text-primary font-medium'
                    : 'text-semantic-text-secondary'
                } sm:hover:bg-snow-storm-light`}
              >
                <span
                  className={`flex items-center justify-center w-4 h-4 rounded border ${
                    isSelected
                      ? 'bg-semantic-brand border-semantic-brand'
                      : 'border-semantic-border-default'
                  }`}
                >
                  {isSelected && <Check size={10} weight="bold" className="text-white" />}
                </span>
                <span className="truncate">{option}</span>
              </button>
            );
          })
        )}
      </div>
    </>
  );

  // Inline mode: render flat list without dropdown wrapper
  if (inline) {
    return <div>{optionList}</div>;
  }

  // Dropdown mode
  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
          selected.length > 0
            ? 'bg-semantic-brand/10 text-semantic-brand-active border-2 border-semantic-brand'
            : 'bg-semantic-bg-elevated text-semantic-text-secondary border border-semantic-border-default'
        }`}
      >
        {label}
        {selected.length > 0 && ` (${selected.length})`}
        <CaretDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 rounded-lg bg-semantic-bg-elevated border border-semantic-border-subtle shadow-lg z-30">
          {optionList}
        </div>
      )}
    </div>
  );
}

export { FilterMultiSelect };
