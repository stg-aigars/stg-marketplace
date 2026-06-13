'use client';

import { useState } from 'react';
import { buildLanguageDisplay, LANGUAGE_PREVIEW_COUNT } from '@/lib/listings/language-display';

interface LanguageListProps {
  /** Raw stored value — a comma-joined language list (e.g. "English, French, German"). */
  value: string;
}

/**
 * Renders an edition's language list inline. Short lists show in full; a
 * genuinely multilingual edition (20+ languages) previews a Baltic-first slice
 * with a "+N more" toggle so the row stays compact without hiding anything.
 * Inline element (no wrapper block) so it flows inside the caller's metadata row.
 */
function LanguageList({ value }: LanguageListProps) {
  const [expanded, setExpanded] = useState(false);
  const { languages, collapsible, hiddenCount } = buildLanguageDisplay(value);

  if (languages.length === 0) return null;

  if (!collapsible) {
    return <span>{languages.join(', ')}</span>;
  }

  const shown = expanded ? languages : languages.slice(0, LANGUAGE_PREVIEW_COUNT);

  return (
    <span>
      {shown.join(', ')}
      {' '}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="text-semantic-brand sm:hover:underline transition-colors duration-250 ease-out-custom"
      >
        {expanded ? 'Show less' : `+${hiddenCount} more`}
      </button>
    </span>
  );
}

export { LanguageList };
export type { LanguageListProps };
