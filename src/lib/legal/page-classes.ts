/** Tailwind class strings shared across the legal pages
 *  (/terms, /seller-terms, /privacy, /cookies).
 *
 *  Kept here rather than duplicated as `const headingClass = '…'` at the top
 *  of each page so a typography tweak lands in one place.
 *
 *  These mirror the project-wide heading hierarchy documented in CLAUDE.md;
 *  the rest of the codebase still uses the raw class strings inline. */

export const LEGAL_SECTION_HEADING_CLASS =
  'text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading';

export const LEGAL_SUB_HEADING_CLASS =
  'text-base font-semibold text-semantic-text-heading pt-1';
