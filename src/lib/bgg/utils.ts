/**
 * BGG Utility Functions
 * Pure utility functions for BGG data — safe for client-side use.
 */

import { decode } from 'he';

const LANGUAGE_MAP: Record<number, { name: string; flag: string; code: string }> = {
  2184: { name: 'English', flag: '🇬🇧', code: 'en' },
  2475: { name: 'Latvian', flag: '🇱🇻', code: 'lv' },
  2481: { name: 'Lithuanian', flag: '🇱🇹', code: 'lt' },
  2474: { name: 'Estonian', flag: '🇪🇪', code: 'et' },
  2219: { name: 'Russian', flag: '🇷🇺', code: 'ru' },
  2165: { name: 'German', flag: '🇩🇪', code: 'de' },
  2480: { name: 'Polish', flag: '🇵🇱', code: 'pl' },
  2241: { name: 'French', flag: '🇫🇷', code: 'fr' },
  2274: { name: 'Spanish', flag: '🇪🇸', code: 'es' },
  2264: { name: 'Italian', flag: '🇮🇹', code: 'it' },
};

export function getLanguageInfo(languageId: number) {
  return LANGUAGE_MAP[languageId] || { name: 'Unknown', flag: '🌍', code: 'unknown' };
}

export function getLanguageFlag(languageName: string): string {
  const entry = Object.values(LANGUAGE_MAP).find(l =>
    l.name.toLowerCase() === languageName.toLowerCase()
  );
  return entry?.flag || '🌍';
}

/**
 * Decode HTML entities from BGG data.
 * BGG often returns entities like &#039; (apostrophe), &amp; (ampersand), etc.
 */
export function decodeHTMLEntities(text: string | undefined | null): string {
  if (!text) return '';
  return decode(text);
}

export function decodeHTMLEntitiesArray(arr: (string | undefined | null)[] | undefined | null): string[] {
  if (!arr) return [];
  return arr.map(decodeHTMLEntities).filter(Boolean);
}

/** Check whether a URL points to a BGG-hosted image (geekdo CDN). */
export function isBggImage(url: string | null | undefined): boolean {
  return !!url?.includes('geekdo-images.com');
}

/** Upgrade a BGG image URL to full resolution. Handles __small and __thumb variants. */
export function toBggFullSize(url: string | null | undefined): string | null {
  if (!url || !isBggImage(url)) return url ?? null;
  if (url.includes('__original/')) return url; // Already full-size
  return url
    .replace(/__(thumb|small)\//, '__original/')
    .replace(/\/fit-in\/\d+x\d+\//, '/0x0/');
}

/**
 * Format a BGG player count range for display. Prefers the numeric min/max
 * from the metadata; falls back to the raw player_count string if those are
 * missing (legacy data path).
 */
export function formatPlayerCount(
  minPlayers: number | null | undefined,
  maxPlayers: number | null | undefined,
  fallback: string | null | undefined,
): string | null {
  if (minPlayers) {
    return maxPlayers && maxPlayers !== minPlayers
      ? `${minPlayers}–${maxPlayers}`
      : `${minPlayers}`;
  }
  return fallback ?? null;
}

/**
 * Normalize BGG playing_time for display. BGG sometimes returns '0' for
 * unknown, which should render as no value.
 */
export function formatPlayingTime(playingTime: string | null | undefined): string | null {
  return playingTime && playingTime !== '0' ? playingTime : null;
}

/**
 * Map BGG weight (1-5 scale) to a human-readable complexity label.
 */
export function getWeightLabel(weight: number): string {
  if (weight < 1.5) return 'Light';
  if (weight < 2.5) return 'Medium Light';
  if (weight < 3.5) return 'Medium';
  if (weight < 4.5) return 'Medium Heavy';
  return 'Heavy';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
