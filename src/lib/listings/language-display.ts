// Display helpers for the stored `listings.language` string, which is a
// comma-joined list of every language an edition's rules cover (see
// MAX_LANGUAGE_FIELD_LENGTH in types.ts). Multilingual editions can carry 20+
// languages, so the UI previews a Baltic-first slice with a "+N more" toggle.
//
// NOTE: a near-identical PRIORITY_LANGUAGES list also lives in VersionStep and
// BrowseFilters. They are intentionally NOT consolidated here yet — the three
// lists differ (BrowseFilters includes Russian; VersionStep does not), so
// unifying them would change filter/sort behavior on those surfaces. This copy
// is the canonical *display* ordering; consolidation is a separate follow-up.

/** Baltic-market languages surface first; everything else sorts alphabetically. */
export const PRIORITY_LANGUAGES = [
  'English',
  'Latvian',
  'Lithuanian',
  'Estonian',
  'German',
  'Russian',
];

/** Split the stored comma-joined value into trimmed, non-empty language names. */
export function parseLanguages(value: string): string[] {
  return value
    .split(',')
    .map((lang) => lang.trim())
    .filter(Boolean);
}

/** Sort languages so Baltic-priority ones lead (in defined order), rest alphabetical. */
export function sortLanguagesByPriority(languages: string[]): string[] {
  return [...languages].sort((a, b) => {
    const aIdx = PRIORITY_LANGUAGES.indexOf(a);
    const bIdx = PRIORITY_LANGUAGES.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });
}

/** How many languages to show before the "+N more" toggle. */
export const LANGUAGE_PREVIEW_COUNT = 6;

/**
 * Parse + sort, then decide whether collapsing is worthwhile. Collapsing only
 * helps when it hides at least 2 languages (hiding "+1 more" is pointless), so
 * a 7-language list renders in full.
 */
export function buildLanguageDisplay(value: string): {
  languages: string[];
  collapsible: boolean;
  hiddenCount: number;
} {
  const languages = sortLanguagesByPriority(parseLanguages(value));
  const collapsible = languages.length > LANGUAGE_PREVIEW_COUNT + 1;
  return {
    languages,
    collapsible,
    hiddenCount: collapsible ? languages.length - LANGUAGE_PREVIEW_COUNT : 0,
  };
}
