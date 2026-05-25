import { ANNOUNCEMENT_SLUG_REGEX, ANNOUNCEMENT_SLUG_RESERVED } from './types';

/**
 * Generate a URL-safe kebab-case slug from a title.
 * Strips diacritics, lowercases, collapses non-alphanumeric runs to '-',
 * trims leading/trailing dashes, caps at 80 chars.
 */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export function validateSlug(slug: string): { ok: true } | { ok: false; reason: string } {
  if (!slug) return { ok: false, reason: 'slug_empty' };
  if (slug.length > 80) return { ok: false, reason: 'slug_too_long' };
  if (!ANNOUNCEMENT_SLUG_REGEX.test(slug)) return { ok: false, reason: 'slug_invalid_chars' };
  if (ANNOUNCEMENT_SLUG_RESERVED.includes(slug)) return { ok: false, reason: 'slug_reserved' };
  return { ok: true };
}
