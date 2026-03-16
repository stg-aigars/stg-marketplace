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
