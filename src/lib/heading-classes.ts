/** Project-wide Tailwind class strings for the three documented heading
 *  visual tiers (CLAUDE.md > Layout Standards). One source of truth so a
 *  typography tweak lands in one place.
 *
 *  These are *visual* tiers — element level still follows document
 *  hierarchy. e.g. a tab-panel title nested under an h2 may render at
 *  SECTION_HEADING_CLASS while semantically remaining an h3.
 */

export const PAGE_HEADING_CLASS =
  'text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading';

export const SECTION_HEADING_CLASS =
  'text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading';

export const CARD_SUBSECTION_HEADING_CLASS = 'text-base font-semibold text-semantic-text-heading';
