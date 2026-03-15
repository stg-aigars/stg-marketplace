/**
 * BGG API Client
 * Server-side only — search games, fetch details and metadata from BoardGameGeek.
 * Simplified for MVP: no Redis caching, no structured logging (add in Week 2+).
 */

import { XMLParser } from 'fast-xml-parser';
import type { BGGGame, BGGVersion, BGGGameMetadata, BGGInboundLink } from './types';
import { classifyGame } from './classifier';
import { BGGError, createRateLimitError, createAPIUnavailableError, createTimeoutError, parseFetchError } from './errors';
import { createBGGHeaders } from './config';
import { decodeHTMLEntities } from './utils';

// Re-export for convenience
export type { BGGGame, BGGVersion, BGGGameMetadata, BGGInboundLink };
export { decodeHTMLEntities, getLanguageFlag, getLanguageInfo, debounce } from './utils';

// ============================================================================
// BGG XML Parser Types
// ============================================================================

interface BGGXMLName {
  '@_type'?: string;
  '@_value': string;
}

interface BGGXMLLink {
  '@_id': string;
  '@_type': string;
  '@_value': string;
  '@_inbound'?: string;
}

interface BGGXMLVersion {
  '@_id': string;
  name?: BGGXMLName | BGGXMLName[];
  yearpublished?: { '@_value': string };
  productcode?: { '@_value': string };
  thumbnail?: string;
  image?: string;
  link?: BGGXMLLink | BGGXMLLink[];
}

interface BGGXMLItem {
  '@_id': string;
  '@_type'?: string;
  name?: BGGXMLName | BGGXMLName[];
  yearpublished?: { '@_value': string };
  minplayers?: { '@_value': string };
  maxplayers?: { '@_value': string };
  minage?: { '@_value': string };
  playingtime?: { '@_value': string };
  thumbnail?: string;
  image?: string;
  description?: string;
  link?: BGGXMLLink | BGGXMLLink[];
  versions?: { item?: BGGXMLVersion | BGGXMLVersion[] };
  statistics?: {
    ratings?: {
      average?: { '@_value': string };
      bayesaverage?: { '@_value': string };
    };
  };
}

interface BGGXMLSearchItem {
  '@_id': string;
  name?: BGGXMLName | BGGXMLName[];
  yearpublished?: { '@_value': string };
}

interface BGGXMLResponse {
  items?: {
    item?: BGGXMLItem | BGGXMLItem[] | BGGXMLSearchItem | BGGXMLSearchItem[];
  };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

// Simple in-memory cache (replace with Redis in Week 2+)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE = 200;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown) {
  cache.delete(key); // Re-insert at end
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// ============================================================================
// Helper: parse names array from XML
// ============================================================================

function parseNames(item: { name?: BGGXMLName | BGGXMLName[] }): BGGXMLName[] {
  return item.name ? (Array.isArray(item.name) ? item.name : [item.name]) : [];
}

function parseLinks(item: { link?: BGGXMLLink | BGGXMLLink[] }): BGGXMLLink[] {
  return item.link ? (Array.isArray(item.link) ? item.link : [item.link]) : [];
}

function getPrimaryName(names: BGGXMLName[]): string {
  return decodeHTMLEntities(
    names.find((n) => n['@_type'] === 'primary')?.['@_value'] || names[0]?.['@_value'] || 'Unknown'
  );
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch comprehensive game metadata (used for type classification and detail pages)
 */
export async function fetchGameMetadata(gameId: number): Promise<BGGGameMetadata | null> {
  const cacheKey = `meta:${gameId}`;
  const cached = getCached<BGGGameMetadata>(cacheKey);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(
      `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}&stats=1`,
      { signal: controller.signal, headers: createBGGHeaders() }
    );
    clearTimeout(timeoutId);

    if (response.status === 429) throw createRateLimitError(5);
    if (response.status >= 500) throw createAPIUnavailableError();
    if (response.status === 404) return null;
    if (!response.ok) throw createAPIUnavailableError();

    const xml = await response.text();
    const parsed = parser.parse(xml) as BGGXMLResponse;
    const item = parsed.items?.item as BGGXMLItem | undefined;
    if (!item) return null;

    const names = parseNames(item);
    const links = parseLinks(item);

    const alternateNames = names
      .filter((n) => n['@_type'] !== 'primary')
      .map((n) => decodeHTMLEntities(n['@_value']))
      .filter(Boolean);

    const inboundLinks: BGGInboundLink[] = links
      .filter((l) => l['@_inbound'] === 'true')
      .map((l) => ({ id: l['@_id'], type: l['@_type'], value: l['@_value'], inbound: true }));

    const outboundLinks: BGGInboundLink[] = links
      .filter((l) => !l['@_inbound'] || l['@_inbound'] === 'false')
      .map((l) => ({ id: l['@_id'], type: l['@_type'], value: l['@_value'], inbound: false }));

    const designers = links
      .filter((l) => l['@_type'] === 'boardgamedesigner')
      .map((l) => decodeHTMLEntities(l['@_value']));

    const minPlayers = item.minplayers?.['@_value'];
    const maxPlayers = item.maxplayers?.['@_value'];
    const rating = item.statistics?.ratings?.average?.['@_value'];
    const bayesaverage = item.statistics?.ratings?.bayesaverage?.['@_value'];

    const metadata: BGGGameMetadata = {
      id: parseInt(item['@_id']),
      name: getPrimaryName(names),
      type: item['@_type'] || 'boardgame',
      yearPublished: item.yearpublished ? parseInt(item.yearpublished['@_value']) : undefined,
      thumbnail: item.thumbnail,
      image: item.image,
      alternateNames: alternateNames.length > 0 ? alternateNames : undefined,
      designers,
      playerCount: minPlayers && maxPlayers ? `${minPlayers}-${maxPlayers}` : undefined,
      minAge: item.minage?.['@_value'] ? parseInt(item.minage['@_value']) : undefined,
      playingTime: item.playingtime?.['@_value'],
      description: item.description,
      rating: rating ? parseFloat(rating) : undefined,
      bayesaverage: bayesaverage ? parseFloat(bayesaverage) : undefined,
      inboundLinks,
      outboundLinks,
    };

    setCache(cacheKey, metadata);
    return metadata;
  } catch (error: unknown) {
    if (error instanceof BGGError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw createTimeoutError();
    throw parseFetchError(error);
  }
}

/**
 * Search BGG for board games by name.
 * Uses exact-then-fuzzy strategy and filters out expansions.
 */
export async function searchGames(query: string): Promise<BGGGame[]> {
  if (!query || query.trim().length < 2) return [];

  const cacheKey = `search:${query.toLowerCase().trim()}`;
  const cached = getCached<BGGGame[]>(cacheKey);
  if (cached) return cached;

  try {
    let searchResults: BGGXMLSearchItem[] = [];

    if (query.length >= 4) {
      // Try exact match first
      const exactResults = await performSearch(query, true);
      if (exactResults.length >= 3) {
        searchResults = exactResults;
      } else {
        // Combine exact + fuzzy, deduped
        const fuzzyResults = await performSearch(query, false);
        const exactIds = new Set(exactResults.map((r) => r['@_id']));
        searchResults = [...exactResults, ...fuzzyResults.filter((r) => !exactIds.has(r['@_id']))];
      }
    } else {
      searchResults = await performSearch(query, false);
    }

    // Parse and enrich top results with metadata for classification
    const parsedResults = searchResults
      .filter((item) => item['@_id'])
      .slice(0, 20)
      .map((item) => {
        const names = parseNames(item);
        return {
          id: parseInt(item['@_id']),
          name: getPrimaryName(names),
          yearPublished: item.yearpublished ? parseInt(item.yearpublished['@_value']) : undefined,
        };
      });

    const enriched = await Promise.all(
      parsedResults.map(async (result) => {
        const metadata = await fetchGameMetadata(result.id);
        if (!metadata) return { ...result, isExpansion: false };

        const classification = classifyGame(metadata);
        const isExp = classification.type === 'expansion' || classification.type === 'standalone-expansion';

        return {
          id: result.id,
          name: result.name || metadata.name,
          yearPublished: result.yearPublished || metadata.yearPublished,
          thumbnail: metadata.thumbnail,
          image: metadata.image,
          designers: metadata.designers,
          playerCount: metadata.playerCount,
          minAge: metadata.minAge,
          playingTime: metadata.playingTime,
          description: metadata.description,
          rating: metadata.rating,
          isExpansion: isExp,
        };
      })
    );

    const baseGames = enriched.filter((game) => !game.isExpansion);
    setCache(cacheKey, baseGames);
    return baseGames;
  } catch (error: unknown) {
    if (error instanceof BGGError) throw error;
    throw parseFetchError(error);
  }
}

/**
 * Get game details by BGG ID
 */
export async function getGameDetails(gameId: number): Promise<BGGGame | null> {
  const cacheKey = `details:${gameId}`;
  const cached = getCached<BGGGame>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}&stats=1`,
      { headers: createBGGHeaders() }
    );
    if (!response.ok) throw new Error(`BGG API error: ${response.status}`);

    const xml = await response.text();
    const parsed = parser.parse(xml) as BGGXMLResponse;
    const item = parsed.items?.item as BGGXMLItem | undefined;
    if (!item) return null;

    const names = parseNames(item);
    const links = parseLinks(item);
    const minPlayers = item.minplayers?.['@_value'];
    const maxPlayers = item.maxplayers?.['@_value'];

    const game: BGGGame = {
      id: parseInt(item['@_id']),
      name: getPrimaryName(names),
      yearPublished: item.yearpublished ? parseInt(item.yearpublished['@_value']) : undefined,
      thumbnail: item.thumbnail,
      image: item.image,
      designers: links.filter((l) => l['@_type'] === 'boardgamedesigner').map((l) => l['@_value']),
      playerCount: minPlayers && maxPlayers ? `${minPlayers}-${maxPlayers}` : undefined,
      minAge: item.minage?.['@_value'] ? parseInt(item.minage['@_value']) : undefined,
      playingTime: item.playingtime?.['@_value'],
      description: item.description,
    };

    setCache(cacheKey, game);
    return game;
  } catch {
    return null;
  }
}

/**
 * Get game versions (editions/languages) by BGG ID
 */
export async function getGameVersions(gameId: number): Promise<BGGVersion[]> {
  const cacheKey = `versions:${gameId}`;
  const cached = getCached<BGGVersion[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}&versions=1`,
      { headers: createBGGHeaders() }
    );
    if (!response.ok) throw new Error(`BGG API error: ${response.status}`);

    const xml = await response.text();
    const parsed = parser.parse(xml) as BGGXMLResponse;
    const item = parsed.items?.item as BGGXMLItem | undefined;
    if (!item?.versions) return [];

    const versionsData = item.versions?.item || [];
    const versionsArray: BGGXMLVersion[] = Array.isArray(versionsData) ? versionsData : [versionsData];

    const versions: BGGVersion[] = versionsArray
      .filter((v) => v['@_id'])
      .map((version) => {
        const vLinks = parseLinks(version);
        const publisherLinks = vLinks.filter((l) => l['@_type'] === 'boardgamepublisher');
        const languageLinks = vLinks.filter((l) => l['@_type'] === 'language');
        const names = parseNames(version);

        return {
          id: parseInt(version['@_id']),
          name: getPrimaryName(names) || 'Unknown Version',
          publisher: publisherLinks[0] ? decodeHTMLEntities(publisherLinks[0]['@_value']) : undefined,
          publishers: publisherLinks.length > 0 ? publisherLinks.map((l) => decodeHTMLEntities(l['@_value'])) : undefined,
          language: languageLinks[0] ? decodeHTMLEntities(languageLinks[0]['@_value']) : undefined,
          languages: languageLinks.length > 0 ? languageLinks.map((l) => decodeHTMLEntities(l['@_value'])) : undefined,
          yearPublished: version.yearpublished ? parseInt(version.yearpublished['@_value']) : undefined,
          productCode: version.productcode?.['@_value'],
          thumbnail: version.thumbnail,
          image: version.image,
        };
      });

    setCache(cacheKey, versions);
    return versions;
  } catch {
    return [];
  }
}

// ============================================================================
// Game metadata enrichment
// ============================================================================

/**
 * Ensures game metadata is populated in the `games` table.
 * Called during listing creation — fetches from BGG API if missing.
 * Idempotent: safe to call multiple times for the same game.
 *
 * @param gameId - BGG game ID (must already exist in games table via CSV import)
 * @param supabase - Supabase client with service role (for writing to games table)
 */
export async function ensureGameMetadata(
  gameId: number,
  supabase: { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<void> {
  // Check if game already has metadata
  const { data: game, error: fetchError } = await supabase
    .from('games')
    .select('player_count, thumbnail')
    .eq('id', gameId)
    .single();

  if (fetchError) {
    console.error(`ensureGameMetadata: error fetching game ${gameId}:`, fetchError);
    return;
  }

  // Already has metadata — nothing to do
  if (game?.player_count && game?.thumbnail) return;

  // Fetch from BGG API
  const metadata = await fetchGameMetadata(gameId);
  if (!metadata) return;

  const { error: updateError } = await supabase
    .from('games')
    .update({
      player_count: metadata.playerCount || null,
      min_age: metadata.minAge || null,
      playing_time: metadata.playingTime || null,
      thumbnail: metadata.thumbnail || null,
      image: metadata.image || null,
      description: metadata.description || null,
      designers: metadata.designers?.length ? metadata.designers : null,
      alternate_names: metadata.alternateNames?.length ? metadata.alternateNames : null,
      bayesaverage: metadata.bayesaverage || null,
      metadata_fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId);

  if (updateError) {
    console.error(`ensureGameMetadata: error updating game ${gameId}:`, updateError);
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

async function performSearch(query: string, exact: boolean = false): Promise<BGGXMLSearchItem[]> {
  const exactParam = exact ? '&exact=1' : '';
  const response = await fetch(
    `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame${exactParam}`,
    { headers: createBGGHeaders() }
  );

  if (!response.ok) throw new Error(`BGG API error: ${response.status}`);

  const xml = await response.text();
  const parsed = parser.parse(xml) as BGGXMLResponse;
  if (!parsed.items) return [];

  const items = parsed.items?.item || [];
  return Array.isArray(items) ? items as BGGXMLSearchItem[] : [items as BGGXMLSearchItem];
}
