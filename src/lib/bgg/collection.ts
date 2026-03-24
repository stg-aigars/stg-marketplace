/**
 * BGG Collection Fetch
 * Fetches a user's board game collection from BGG XML API.
 * Handles the BGG 202 pattern (collection not cached, needs generation).
 */

import { XMLParser } from 'fast-xml-parser';
import { createBGGHeaders, BGG_CONFIG } from './config';
import { decodeHTMLEntities } from './utils';

export interface BGGCollectionItem {
  bggGameId: number;
  name: string;
  yearPublished: number | null;
  thumbnail: string | null;
  isExpansion: boolean;
}

export type CollectionFetchResult =
  | { status: 'success'; items: BGGCollectionItem[] }
  | { status: 'generating' }
  | { status: 'error'; message: string };

/**
 * Fetch a BGG user's collection. Returns 'generating' when BGG returns 202
 * (collection is being prepared). Caller should poll.
 */
export async function fetchBGGCollection(
  username: string
): Promise<CollectionFetchResult> {
  const url = `${BGG_CONFIG.API_BASE_URL}/collection?username=${encodeURIComponent(username)}&own=1&subtype=boardgame&excludesubtype=boardgameexpansion`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: createBGGHeaders(),
    });
    clearTimeout(timeoutId);

    // BGG returns 202 when collection needs to be generated
    if (response.status === 202) {
      return { status: 'generating' };
    }

    if (response.status === 404) {
      return { status: 'error', message: 'BGG user not found' };
    }

    if (!response.ok) {
      return { status: 'error', message: `BGG returned status ${response.status}` };
    }

    const xml = await response.text();
    const items = parseCollectionXml(xml);
    return { status: 'success', items };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { status: 'error', message: 'BGG request timed out' };
    }
    return { status: 'error', message: 'Failed to fetch BGG collection' };
  }
}

function parseCollectionXml(xml: string): BGGCollectionItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'item',
  });

  const parsed = parser.parse(xml);
  const items = parsed?.items?.item;
  if (!items || !Array.isArray(items)) return [];

  return items
    .map((item: Record<string, unknown>): BGGCollectionItem | null => {
      const id = parseInt(String(item['@_objectid'] ?? '0'));
      if (!id) return null;

      const nameVal = item.name as { '#text'?: string; '@_value'?: string } | string | undefined;
      const name = typeof nameVal === 'string'
        ? nameVal
        : (nameVal?.['#text'] ?? nameVal?.['@_value'] ?? '');

      const yearPub = item.yearpublished as string | number | undefined;
      const year = yearPub ? parseInt(String(yearPub)) : null;

      const thumbnail = (item.thumbnail as string) || null;
      const subtype = String(item['@_subtype'] ?? 'boardgame');

      return {
        bggGameId: id,
        name: decodeHTMLEntities(String(name)),
        yearPublished: year && !isNaN(year) ? year : null,
        thumbnail,
        isExpansion: subtype === 'boardgameexpansion',
      };
    })
    .filter((item): item is BGGCollectionItem => item !== null);
}
