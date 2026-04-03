'use client';

import { useRef, useState, useEffect } from 'react';

interface ShowMoreTextProps {
  /** Number of lines to show when collapsed */
  lines?: number;
  children: React.ReactNode;
  className?: string;
}

function ShowMoreText({ lines = 4, children, className }: ShowMoreTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // Compare actual height to clamped height to detect truncation
    setIsTruncated(el.scrollHeight > el.clientHeight + 1);
  }, [children]);

  return (
    <div>
      <div
        ref={contentRef}
        className={className}
        style={expanded ? undefined : { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {children}
      </div>
      {(isTruncated || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-semantic-brand font-medium mt-1.5 cursor-pointer"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export { ShowMoreText };
export type { ShowMoreTextProps };
