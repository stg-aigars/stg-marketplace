/**
 * Unisend API Client
 * Server-side client for Unisend Terminal-to-Terminal shipping
 *
 * Usage:
 *   const client = getUnisendClient();
 *   const terminals = await client.getTerminals('LT');
 */

import {
  type AuthResponse,
  type Terminal,
  type TerminalCountry,
  type CreateParcelRequest,
  type ParcelResponse,
  type ShippingInitiateRequest,
  type ShippingInitiateResponse,
  type BarcodeInfo,
  type TrackingEvent,
  type ValidationErrorItem,
  UnisendValidationError,
  UnisendApiError,
} from './types';
import { env } from '@/lib/env';
import { cacheGet, cacheSet, cacheDel } from '@/lib/cache';

// ============================================
// Token cache (in-memory for serverless)
// ============================================

let tokenCache: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null = null;

// Auth circuit breaker — prevents hitting Unisend's 5-attempt lockout (15 min block).
// Threshold of 2 consecutive failures × 2 auth attempts per failure = 4 attempts,
// safely under the 5-attempt cap. Resets on successful API call or server restart.
let consecutiveAuthFailures = 0;
const AUTH_FAILURE_THRESHOLD = 2;
const LOCKOUT_DURATION_MS = 16 * 60 * 1000; // 16 min (slightly > Unisend's 15 min lockout)
let authLockoutUntil: number | null = null;

const TERMINAL_CACHE_TTL_SECONDS = 60 * 60; // 1 hour

// ============================================
// Token Management
// ============================================

async function authenticate(): Promise<AuthResponse> {
  const { apiUrl, username, password } = env.unisend;

  if (!username || !password) {
    throw new UnisendApiError('Unisend credentials not configured', 500);
  }

  const params = new URLSearchParams({
    scope: 'read+write+API_CLIENT',
    grant_type: 'password',
    clientSystem: 'PUBLIC',
    username,
    password,
  });

  const response = await fetch(`${apiUrl}/oauth/token?${params.toString()}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new UnisendApiError(`Authentication failed: ${text}`, response.status);
  }

  const data: AuthResponse = await response.json();

  // Cache the token (expire 60 seconds early to be safe)
  tokenCache = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  const ttlSeconds = Math.max(0, data.expires_in - 60);
  if (ttlSeconds > 0) {
    await cacheSet('unisend:token', tokenCache, ttlSeconds).catch(() => {});
  }

  return data;
}

async function refreshAccessToken(): Promise<void> {
  if (!tokenCache?.refreshToken) {
    await authenticate();
    return;
  }

  const { apiUrl } = env.unisend;

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenCache.refreshToken,
  });

  const response = await fetch(`${apiUrl}/oauth/token?${params.toString()}`, {
    method: 'POST',
  });

  if (!response.ok) {
    tokenCache = null;
    await authenticate();
    return;
  }

  const data: AuthResponse = await response.json();

  tokenCache = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  const ttlSeconds = Math.max(0, data.expires_in - 60);
  if (ttlSeconds > 0) {
    await cacheSet('unisend:token', tokenCache, ttlSeconds).catch(() => {});
  }
}

async function getAccessToken(): Promise<string> {
  // L1: Check in-memory (fastest, same-invocation reuse)
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }

  // L2: Check cache (survives cold starts)
  const cached = await cacheGet<typeof tokenCache>('unisend:token');
  if (cached && cached.expiresAt > Date.now()) {
    tokenCache = cached;
    return cached.accessToken;
  }

  // L3: Authenticate with Unisend API
  if (tokenCache?.refreshToken) {
    await refreshAccessToken();
  } else {
    await authenticate();
  }

  if (!tokenCache) {
    throw new UnisendApiError('Failed to obtain access token', 500);
  }

  return tokenCache.accessToken;
}

// ============================================
// API Request Helper
// ============================================

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  // Circuit breaker: fail fast if we've hit too many consecutive auth failures
  if (authLockoutUntil && Date.now() < authLockoutUntil) {
    throw new UnisendApiError(
      `Unisend auth circuit open until ${new Date(authLockoutUntil).toISOString()}. Check credentials.`,
      503
    );
  }

  const accessToken = await getAccessToken();
  const { apiUrl } = env.unisend;

  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Handle 401 - token might be expired, retry once
  if (response.status === 401 && retryCount < 1) {
    tokenCache = null;
    return apiRequest<T>(endpoint, options, retryCount + 1);
  }

  // Second 401 after retry — track consecutive failures and potentially trip circuit
  if (response.status === 401) {
    consecutiveAuthFailures++;
    if (consecutiveAuthFailures >= AUTH_FAILURE_THRESHOLD) {
      authLockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      console.error(
        `[Unisend] Auth circuit opened — ${consecutiveAuthFailures} consecutive failures. Locked out for 16 minutes.`
      );
    }
  }

  if (!response.ok) {
    await handleApiError(response);
  }

  // Successful response — reset circuit breaker
  consecutiveAuthFailures = 0;
  authLockoutUntil = null;

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text);
}

async function handleApiError(response: Response): Promise<never> {
  const text = await response.text();

  try {
    const data = JSON.parse(text);

    // Array of validation errors
    if (Array.isArray(data) && data.length > 0) {
      const validationErrors: ValidationErrorItem[] = data.map((e: Record<string, string>) => ({
        field: e.field || '',
        error: e.error || '',
        error_description: e.error_description || e.error || '',
      }));
      throw new UnisendValidationError('Validation failed', validationErrors);
    }

    // Single error object
    if (data.error || data.error_description) {
      throw new UnisendApiError(
        data.error_description || data.error,
        response.status
      );
    }
  } catch (e) {
    if (e instanceof UnisendValidationError || e instanceof UnisendApiError) {
      throw e;
    }
  }

  throw new UnisendApiError(`Unisend API error: ${response.status} ${text}`, response.status);
}

// ============================================
// Public API Methods
// ============================================

/**
 * Get available terminals for a country.
 * Results are cached for 1 hour.
 */
export async function getTerminals(
  countryCode: TerminalCountry
): Promise<Terminal[]> {
  const cacheKey = `unisend:terminals:${countryCode}`;

  const cached = await cacheGet<Terminal[]>(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({ receiverCountryCode: countryCode });
  const terminals = await apiRequest<Terminal[]>(`/api/v2/terminal?${params}`);

  await cacheSet(cacheKey, terminals, TERMINAL_CACHE_TTL_SECONDS).catch(() => {});

  return terminals;
}

/**
 * Get all terminals across all countries (LT, LV, EE).
 * Results are cached for 1 hour.
 */
export async function getAllTerminals(): Promise<Terminal[]> {
  const cacheKey = 'unisend:terminals:all';

  const cached = await cacheGet<Terminal[]>(cacheKey);
  if (cached) return cached;

  const countries: TerminalCountry[] = ['LT', 'LV', 'EE'];
  const results = await Promise.allSettled(countries.map((c) => getTerminals(c)));
  const all = results
    .filter((r): r is PromiseFulfilledResult<Terminal[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  // Log failures but don't block checkout
  const allSucceeded = results.every((r) => r.status === 'fulfilled');
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[Unisend] Failed to fetch terminals for ${countries[i]}:`, r.reason);
    }
  });

  // Only cache when all countries succeeded — partial results would hide
  // terminals for the failed country for the entire cache TTL
  if (allSucceeded) {
    await cacheSet(cacheKey, all, TERMINAL_CACHE_TTL_SECONDS).catch(() => {});
  }

  return all;
}

/** Create a parcel for shipping */
export async function createParcel(data: CreateParcelRequest): Promise<ParcelResponse> {
  console.log('[Unisend] POST /api/v2/parcel payload: plan=%s', data.plan?.code ?? 'unknown');
  try {
    const result = await apiRequest<ParcelResponse>('/api/v2/parcel', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    console.log('[Unisend] POST /api/v2/parcel success');
    return result;
  } catch (error) {
    console.error('[Unisend] POST /api/v2/parcel error:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/** Initiate shipping (finalize parcels and assign barcodes) */
export async function initiateShipping(
  data: ShippingInitiateRequest
): Promise<ShippingInitiateResponse> {
  return apiRequest<ShippingInitiateResponse>(
    '/api/v2/shipping/initiate?processAsync=false',
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

/** Get barcode and tracking info for parcels */
export async function getBarcodes(parcelIds: number[]): Promise<BarcodeInfo[]> {
  if (parcelIds.length === 0) {
    return [];
  }

  try {
    const params = new URLSearchParams();
    parcelIds.forEach((id) => params.append('parcelIds', String(id)));

    const response = await apiRequest<Array<{
      parcelId: number;
      barcode: string;
      trackable: boolean;
      status: string;
    }>>(`/api/v2/shipping/barcode/list?${params.toString()}`);

    return response.map((item) => ({
      parcelId: String(item.parcelId),
      barcode: item.barcode || '',
      trackingUrl: undefined,
    }));
  } catch (error) {
    console.error('[Unisend] Failed to get barcodes:', error);
    return parcelIds.map((id) => ({
      parcelId: String(id),
      barcode: '',
      trackingUrl: undefined,
    }));
  }
}

/**
 * Unisend returns naive datetimes in Europe/Vilnius. Append offset for Postgres TIMESTAMPTZ.
 *
 * Trade-off: parses the naive string as UTC to look up the Vilnius offset at that instant.
 * The 2–3h difference between "wrong UTC" and "real Vilnius" means the offset lookup uses
 * a slightly wrong instant — but since DST transitions are hours apart, the computed offset
 * is correct except during the ~1h spring-forward gap (wall-clock times that don't exist in
 * Vilnius). In that edge case the timestamp may be off by 1 hour — cosmetic for shipping
 * tracking, not a data-integrity issue. Unisend rarely emits events during the skipped hour.
 */
function normalizeEventDate(eventDate: string): string {
  if (eventDate.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(eventDate)) {
    return eventDate;
  }
  const date = new Date(`${eventDate}Z`);
  const vilniusTime = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Vilnius' }));
  const utcTime = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMinutes = (vilniusTime.getTime() - utcTime.getTime()) / 60000;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${eventDate}${sign}${hh}:${mm}`;
}

/** Get tracking events for a barcode, normalized and validated at boundary */
export async function getTrackingEvents(
  barcode: string,
  lang: 'en' | 'lt' = 'en'
): Promise<TrackingEvent[]> {
  const result = await apiRequest<TrackingEvent[]>(`/api/v2/tracking/${barcode}/events`, {
    headers: {
      'Accept-Language': lang,
    },
  });
  if (!Array.isArray(result)) return [];
  return result.filter(e => {
    if (!e.publicStateType || !e.eventDate) {
      console.warn('[Tracking] Skipping event with missing fields:', {
        barcode,
        publicStateType: e.publicStateType,
        eventDate: e.eventDate,
        publicEventType: e.publicEventType,
      });
      return false;
    }
    return true;
  }).map(e => ({
    ...e,
    eventDate: normalizeEventDate(e.eventDate),
  }));
}

/**
 * Fetch tracking events for multiple barcodes in a single request.
 * Uses POST /api/v2/tracking/events with optional dateFrom filter.
 */
export async function getTrackingEventsBulk(
  barcodes: string[],
  dateFrom?: string,
  lang: 'en' | 'lt' = 'en'
): Promise<TrackingEvent[]> {
  if (barcodes.length === 0) return [];
  const queryParams = dateFrom ? `?dateFrom=${encodeURIComponent(dateFrom)}` : '';
  const result = await apiRequest<TrackingEvent[]>(
    `/api/v2/tracking/events${queryParams}`,
    {
      method: 'POST',
      headers: { 'Accept-Language': lang },
      body: JSON.stringify(barcodes),
    }
  );
  if (!Array.isArray(result)) return [];
  return result
    .filter(e => {
      if (!e.publicStateType || !e.eventDate || !e.mailBarcode) {
        console.warn('[Tracking] Skipping event with missing fields:', {
          mailBarcode: e.mailBarcode,
          publicStateType: e.publicStateType,
          eventDate: e.eventDate,
          publicEventType: e.publicEventType,
        });
        return false;
      }
      return true;
    })
    .map(e => ({ ...e, eventDate: normalizeEventDate(e.eventDate) }));
}

// ============================================
// Convenience Methods
// ============================================

/** Cancel a Unisend shipment before pickup */
export async function cancelShipment(parcelIds: number[]): Promise<void> {
  await apiRequest('/api/v2/shipping/cancel', {
    method: 'POST',
    body: JSON.stringify({ parcelIds }),
  });
}

/** Create parcel and initiate shipping in one call */
export async function createAndShipParcel(
  data: CreateParcelRequest
): Promise<{
  parcelId: number;
  barcode: string;
  trackingUrl?: string;
  requestId: string;
}> {
  const parcelResponse = await createParcel(data);

  const shippingResponse = await initiateShipping({ parcelIds: [parcelResponse.parcelId] });

  const parcelFromShipping = shippingResponse.parcels?.find(p => p.parcelId === parcelResponse.parcelId);
  if (parcelFromShipping?.barcode || parcelFromShipping?.trackingNumber) {
    return {
      parcelId: parcelResponse.parcelId,
      barcode: parcelFromShipping.barcode || parcelFromShipping.trackingNumber || '',
      trackingUrl: parcelFromShipping.trackingUrl,
      requestId: shippingResponse.requestId,
    };
  }

  const barcodes = await getBarcodes([parcelResponse.parcelId]);

  return {
    parcelId: parcelResponse.parcelId,
    barcode: barcodes[0]?.barcode || '',
    trackingUrl: barcodes[0]?.trackingUrl,
    requestId: shippingResponse.requestId,
  };
}

/** Clear terminal cache */
export async function clearTerminalCache(): Promise<void> {
  const countries: TerminalCountry[] = ['LT', 'LV', 'EE'];
  await Promise.all([
    ...countries.map((c) => cacheDel(`unisend:terminals:${c}`)),
    cacheDel('unisend:terminals:all'),
  ]).catch(() => {});
}

/** Clear token cache */
export function clearTokenCache(): void {
  tokenCache = null;
}

// ============================================
// Singleton Export
// ============================================

const unisendClient = {
  getTerminals,
  getAllTerminals,
  createParcel,
  initiateShipping,
  getBarcodes,
  getTrackingEvents,
  getTrackingEventsBulk,
  cancelShipment,
  createAndShipParcel,
  clearTerminalCache,
  clearTokenCache,
};

export type UnisendClient = typeof unisendClient;

export function getUnisendClient(): UnisendClient {
  return unisendClient;
}

export default unisendClient;
