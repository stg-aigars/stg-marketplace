/**
 * BGG API Client
 * Server-side only — search games, fetch details and metadata from BoardGameGeek.
 * Simplified for MVP: no Redis caching, no structured logging (add in Week 2+).
 */

import { XMLParser } from 'fast-xml-parser';
import type { BGGGame, BGGVersion, BGGGameMetadata, BGGInboundLink } from './types';
import { classifyGame } from './classifier';
import { BGGError, createRateLimitError, createAPIUnavailableError, createTimeoutError, parseFetchError } from './errors';
import { createBGGHeaders, BGG_CONFIG } from './config';
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
      averageweight?: { '@_value': string };
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
// Rate-limited fetch for BGG API
// ============================================================================

let lastBGGRequestTime = 0;
const BGG_MAX_RETRIES = 3;

/**
 * Fetch wrapper that enforces BGG_API_RATE_LIMIT_MS between requests
 * and retries with exponential backoff on 429 responses.
 */
async function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= BGG_MAX_RETRIES; attempt++) {
    // Enforce minimum delay between BGG requests
    const now = Date.now();
    const elapsed = now - lastBGGRequestTime;
    if (elapsed < BGG_CONFIG.RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, BGG_CONFIG.RATE_LIMIT_MS - elapsed));
    }
    lastBGGRequestTime = Date.now();

    const response = await fetch(url, init);

    if (response.status === 429 && attempt < BGG_MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    return response;
  }

  throw createRateLimitError(5);
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

/**
 * Parse a player_count string like "2-4" or "2" into min/max integer fields.
 */
function parsePlayerCountRange(playerCount: string | null | undefined): {
  min_players: number | null;
  max_players: number | null;
} {
  if (!playerCount) return { min_players: null, max_players: null };
  // Handle en-dash and hyphen variants
  const dashMatch = playerCount.match(/^(\d+)[–-](\d+)$/);
  if (dashMatch) {
    return { min_players: parseInt(dashMatch[1], 10), max_players: parseInt(dashMatch[2], 10) };
  }
  const singleMatch = playerCount.match(/^(\d+)$/);
  if (singleMatch) {
    const n = parseInt(singleMatch[1], 10);
    return { min_players: n, max_players: n };
  }
  return { min_players: null, max_players: null };
}

/**
 * Shared helper: parse versions from a BGG XML item.
 * Used by both fetchGameMetadata() and getGameVersions() to ensure
 * identical BGGVersion[] shape regardless of which code path writes to the DB.
 */
function parseVersionsFromXML(item: BGGXMLItem): BGGVersion[] {
  if (!item.versions?.item) return [];
  const versionsData = item.versions.item;
  const versionsArray: BGGXMLVersion[] = Array.isArray(versionsData) ? versionsData : [versionsData];

  return versionsArray
    .filter((v) => v['@_id'])
    .map((version) => {
      const vLinks = parseLinks(version);
      const publisherLinks = vLinks.filter((l) => l['@_type'] === 'boardgamepublisher');
      const languageLinks = vLinks.filter((l) => l['@_type'] === 'language');
      const vNames = parseNames(version);

      return {
        id: parseInt(version['@_id']),
        name: getPrimaryName(vNames) || 'Unknown Version',
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

    const response = await rateLimitedFetch(
      `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}&stats=1&versions=1`,
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

    const categories = links
      .filter((l) => l['@_type'] === 'boardgamecategory')
      .map((l) => decodeHTMLEntities(l['@_value']));

    const mechanics = links
      .filter((l) => l['@_type'] === 'boardgamemechanic')
      .map((l) => decodeHTMLEntities(l['@_value']));

    const minPlayers = item.minplayers?.['@_value'];
    const maxPlayers = item.maxplayers?.['@_value'];
    const rating = item.statistics?.ratings?.average?.['@_value'];
    const bayesaverage = item.statistics?.ratings?.bayesaverage?.['@_value'];
    const averageweight = item.statistics?.ratings?.averageweight?.['@_value'];

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
      weight: averageweight ? parseFloat(averageweight) : undefined,
      categories: categories.length > 0 ? categories : undefined,
      mechanics: mechanics.length > 0 ? mechanics : undefined,
      inboundLinks,
      outboundLinks,
      versions: parseVersionsFromXML(item),
    };

    // Exclude versions from in-memory cache to avoid bloating the 200-entry Map
    // (some games have 50+ versions). Versions are persisted to DB by ensureGameMetadata.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { versions: _cachedVersions, ...metadataWithoutVersions } = metadata;
    setCache(cacheKey, metadataWithoutVersions);
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
    const response = await rateLimitedFetch(
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const response = await rateLimitedFetch(
    `https://boardgamegeek.com/xmlapi2/thing?id=${gameId}&versions=1`,
    { signal: controller.signal, headers: createBGGHeaders() }
  );
  clearTimeout(timeoutId);

  if (response.status === 429) throw createRateLimitError(5);
  if (response.status >= 500) throw createAPIUnavailableError();
  if (!response.ok) throw createAPIUnavailableError();

  const xml = await response.text();
  const parsed = parser.parse(xml) as BGGXMLResponse;
  const item = parsed.items?.item as BGGXMLItem | undefined;
  if (!item) return [];

  // Uses shared parseVersionsFromXML to ensure identical BGGVersion[] shape
  // as fetchGameMetadata — both paths write to games.versions JSONB.
  const versions = parseVersionsFromXML(item);

  setCache(cacheKey, versions);
  return versions;
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
  // Check if game already has metadata + versions
  const { data: game, error: fetchError } = await supabase
    .from('games')
    .select('player_count, thumbnail, versions_fetched_at')
    .eq('id', gameId)
    .single();

  if (fetchError) {
    console.error(`ensureGameMetadata: error fetching game ${gameId}:`, fetchError);
    return;
  }

  const hasMetadata = !!(game?.player_count && game?.thumbnail);
  const hasVersions = !!game?.versions_fetched_at;

  // Already has metadata AND versions — nothing to do
  if (hasMetadata && hasVersions) return;

  // If metadata exists but versions don't (pre-migration game), only fetch versions.
  // This avoids an unnecessary full BGG re-fetch for the ~170k already-enriched games.
  if (hasMetadata && !hasVersions) {
    const versions = await getGameVersions(gameId);
    const { error: versionError } = await supabase
      .from('games')
      .update({
        versions: versions.length > 0 ? versions : null,
        versions_fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', gameId);
    if (versionError) {
      console.error(`ensureGameMetadata: error updating versions for game ${gameId}:`, versionError);
    }
    return;
  }

  // Fetch full metadata + versions from BGG API (single combined request)
  const metadata = await fetchGameMetadata(gameId);
  if (!metadata) return;

  const { error: updateError } = await supabase
    .from('games')
    .update({
      player_count: metadata.playerCount || null,
      ...parsePlayerCountRange(metadata.playerCount),
      min_age: metadata.minAge || null,
      playing_time: metadata.playingTime || null,
      thumbnail: metadata.thumbnail || null,
      image: metadata.image || null,
      description: metadata.description || null,
      designers: metadata.designers?.length ? metadata.designers : null,
      alternate_names: metadata.alternateNames?.length ? metadata.alternateNames : null,
      bayesaverage: metadata.bayesaverage || null,
      weight: metadata.weight || null,
      categories: metadata.categories?.length ? metadata.categories : null,
      mechanics: metadata.mechanics?.length ? metadata.mechanics : null,
      // Versions cached from the same BGG API call (uses parseVersionsFromXML)
      versions: metadata.versions?.length ? metadata.versions : null,
      versions_fetched_at: new Date().toISOString(),
      metadata_fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId);

  if (updateError) {
    console.error(`ensureGameMetadata: error updating game ${gameId}:`, updateError);
  }
}

const VERSIONS_STALE_DAYS = 90;

/**
 * Ensures game versions are available, serving from DB cache when fresh.
 * Falls back to BGG API if versions are missing or stale (>90 days).
 * Uses parseVersionsFromXML via getGameVersions for identical JSONB shape.
 *
 * @param gameId - BGG game ID
 * @param supabase - Supabase client with service role (for reading/writing games table)
 */
export async function ensureGameVersions(
  gameId: number,
  supabase: { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<BGGVersion[]> {
  // Check DB for cached versions
  const { data: game, error: fetchError } = await supabase
    .from('games')
    .select('versions, versions_fetched_at')
    .eq('id', gameId)
    .single();

  if (fetchError) {
    console.error(`ensureGameVersions: error fetching game ${gameId}:`, fetchError);
    // Fall through to BGG API — don't block the user
  }

  // Return cached versions if fresh (check versions_fetched_at only, not versions,
  // so games with zero BGG versions don't re-fetch every time)
  if (game?.versions_fetched_at) {
    const ageMs = Date.now() - new Date(game.versions_fetched_at).getTime();
    if (ageMs < VERSIONS_STALE_DAYS * 24 * 60 * 60 * 1000) {
      return (game.versions as BGGVersion[]) ?? [];
    }
  }

  // Fetch from BGG API — propagates BGGError (rate limit, timeout, unavailable)
  // so the route can return appropriate status codes. Does NOT write
  // versions_fetched_at on failure, avoiding poisoned cache entries.
  const versions = await getGameVersions(gameId);

  // Persist to DB (uses parseVersionsFromXML via getGameVersions for identical JSONB shape)
  const { error: updateError } = await supabase
    .from('games')
    .update({
      versions: versions.length > 0 ? versions : null,
      versions_fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId);

  if (updateError) {
    console.error(`ensureGameVersions: error persisting versions for game ${gameId}:`, updateError);
  }

  return versions;
}

// ============================================================================
// Internal helpers
// ============================================================================

async function performSearch(query: string, exact: boolean = false): Promise<BGGXMLSearchItem[]> {
  const exactParam = exact ? '&exact=1' : '';
  const response = await rateLimitedFetch(
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
