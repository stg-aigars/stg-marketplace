import { remark } from 'remark';
import strip from 'strip-markdown';

/**
 * Convert a markdown body to a plain-text excerpt, then truncate.
 * Used for OG description, Article JSON-LD articleBody, and the list-page
 * preview. Strips all markdown syntax — no asterisks, no link brackets,
 * no heading hashes leak into the visible excerpt.
 */
export function markdownExcerpt(body: string, maxLength = 160): string {
  const plain = remark().use(strip).processSync(body).toString().trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trimEnd() + '…';
}
