'use client';

import { useState, Children } from 'react';

interface ShowMoreListProps {
  /** Maximum items to show when collapsed */
  maxItems?: number;
  /** Label for the items (e.g., "expansions") — used in toggle text */
  label: string;
  children: React.ReactNode;
}

function ShowMoreList({ maxItems = 2, label, children }: ShowMoreListProps) {
  const [expanded, setExpanded] = useState(false);
  const childArray = Children.toArray(children);
  const total = childArray.length;

  if (total <= maxItems) {
    return <>{children}</>;
  }

  return (
    <>
      {expanded ? children : childArray.slice(0, maxItems)}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-semantic-brand font-medium mt-1 cursor-pointer"
      >
        {expanded ? 'Show less' : `Show all ${total} ${label}`}
      </button>
    </>
  );
}

export { ShowMoreList };
export type { ShowMoreListProps };
