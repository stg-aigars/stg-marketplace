/** Project-wide Tailwind class string for the H2 section heading,
 *  per the heading tier documented in CLAUDE.md (Layout Standards).
 *
 *  Kept here rather than duplicated as raw strings at every call site so
 *  a typography tweak lands in one place. The H1 and H2-card-subsection
 *  tiers from the same standards stay inline at their call sites today. */

export const SECTION_HEADING_CLASS =
  'text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading';
