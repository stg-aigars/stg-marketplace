import { cache } from 'react';
import { remark } from 'remark';
import strip from 'strip-markdown';

/**
 * Strip all markdown syntax to plain text. Per-request memoized via React
 * cache() so multiple markdownExcerpt() calls with the same body argument
 * in a single request share one remark pass (the detail page calls it twice
 * — for OG description and Article JSON-LD — without this, both would
 * separately initialize a remark processor and walk the AST).
 */
const stripMarkdown = cache((body: string): string => {
  return remark().use(strip).processSync(body).toString().trim();
});

/**
 * Convert a markdown body to a plain-text excerpt, then truncate.
 * Used for OG description, Article JSON-LD articleBody, and the list-page
 * preview.
 */
export function markdownExcerpt(body: string, maxLength = 160): string {
  const plain = stripMarkdown(body);
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trimEnd() + '…';
}
