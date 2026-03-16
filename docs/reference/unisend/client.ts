/**
 * Unisend API Client
 * Server-side client for Unisend Terminal-to-Terminal shipping
 *
 * Usage:
 *   const client = getUnisendClient();
 *   const terminals = await client.getTerminals('LT');
 */

import {
  AuthResponse,
  Terminal,
  TerminalCountry,
  CreateParcelRequest,
  ParcelResponse,
  ShippingInitiateRequest,
  ShippingInitiateResponse,
  BarcodeInfo,
  TrackingEvent,
  LabelLayout,
  LabelOrientation,
  UnisendValidationError,
  UnisendApiError,
  ValidationErrorItem,
} from './types';
import { cacheGet, cacheSet } from '@/lib/cache';

// ============================================
// Configuration
// ============================================

const UNISEND_API_URL = process.env.UNISEND_API_URL || 'https://api-manosiuntostst.post.lt';
const UNISEND_USERNAME = process.env.UNISEND_USERNAME || '';
const UNISEND_PASSWORD = process.env.UNISEND_PASSWORD || '';

// Token cache (in-memory for serverless - consider Redis for production)
let tokenCache: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null = null;

// Terminal cache TTL
const TERMINAL_CACHE_TTL_SECONDS = 60 * 60; // 1 hour

// ============================================
// Token Management
// ============================================

async function authenticate(): Promise<AuthResponse> {
  if (!UNISEND_USERNAME || !UNISEND_PASSWORD) {
    throw new UnisendApiError('Unisend credentials not configured', 500);
  }

  // Unisend expects OAuth params in query string, not body
  const params = new URLSearchParams({
    scope: 'read+write+API_CLIENT',
    grant_type: 'password',
    clientSystem: 'PUBLIC',
    username: UNISEND_USERNAME,
    password: UNISEND_PASSWORD,
  });

  const response = await fetch(`${UNISEND_API_URL}/oauth/token?${params.toString()}`, {
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

  // Persist to Redis so other serverless instances can reuse
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

  // Unisend expects OAuth params in query string
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenCache.refreshToken,
  });

  const response = await fetch(`${UNISEND_API_URL}/oauth/token?${params.toString()}`, {
    method: 'POST',
  });

  if (!response.ok) {
    // Refresh failed, try full authentication
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

  // Persist to Redis so other serverless instances can reuse
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

  // L2: Check Redis (survives cold starts)
  const redisToken = await cacheGet<typeof tokenCache>('unisend:token');
  if (redisToken && redisToken.expiresAt > Date.now()) {
    tokenCache = redisToken;
    return redisToken.accessToken;
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
  const accessToken = await getAccessToken();

  const response = await fetch(`${UNISEND_API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Handle 401 - token might be expired
  if (response.status === 401 && retryCount < 1) {
    tokenCache = null;
    return apiRequest<T>(endpoint, options, retryCount + 1);
  }

  if (!response.ok) {
    await handleApiError(response);
  }

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
      const validationErrors: ValidationErrorItem[] = data.map((e) => ({
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
 * Get available terminals for a country
 * Results are cached in Redis (+ in-memory fallback) for 1 hour
 */
export async function getTerminals(
  countryCode: TerminalCountry
): Promise<Terminal[]> {
  const cacheKey = `unisend:terminals:${countryCode}`;

  // Check cache first (Redis with in-memory fallback)
  const cached = await cacheGet<Terminal[]>(cacheKey);
  if (cached) return cached;

  // Fetch from API
  const params = new URLSearchParams({ receiverCountryCode: countryCode });
  const terminals = await apiRequest<Terminal[]>(`/api/v2/terminal?${params}`);

  // Cache the results
  await cacheSet(cacheKey, terminals, TERMINAL_CACHE_TTL_SECONDS).catch(() => {});

  return terminals;
}

/**
 * Get all terminals across all countries (LT, LV, EE)
 * Results are cached in Redis for 1 hour
 */
export async function getAllTerminals(): Promise<Terminal[]> {
  const cacheKey = 'unisend:terminals:all';

  const cached = await cacheGet<Terminal[]>(cacheKey);
  if (cached) return cached;

  const countries: TerminalCountry[] = ['LT', 'LV', 'EE'];
  const results = await Promise.all(countries.map((c) => getTerminals(c)));
  const all = results.flat();

  await cacheSet(cacheKey, all, TERMINAL_CACHE_TTL_SECONDS).catch(() => {});

  return all;
}

/**
 * Create a parcel for shipping
 * Called when seller accepts an order
 */
export async function createParcel(data: CreateParcelRequest): Promise<ParcelResponse> {
  return apiRequest<ParcelResponse>('/api/v2/parcel', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Initiate shipping (finalize and generate label)
 * Called after parcel is created
 */
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

/**
 * Get barcode and tracking info for parcels
 * Uses /api/v2/shipping/barcode/list endpoint
 * Note: For T2T parcels, barcode is assigned when seller prints at terminal
 */
export async function getBarcodes(parcelIds: number[]): Promise<BarcodeInfo[]> {
  if (parcelIds.length === 0) {
    return [];
  }

  try {
    // Build query string with parcelIds
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
      trackingUrl: undefined, // API doesn't return tracking URLs, we construct them from barcode
    }));
  } catch (error) {
    console.error('[Unisend] Failed to get barcodes:', error);
    // Return empty barcodes if we can't fetch
    return parcelIds.map((id) => ({
      parcelId: String(id),
      barcode: '',
      trackingUrl: undefined,
    }));
  }
}

/**
 * Generate shipping label PDF
 */
export async function generateLabel(
  parcelIds: number[],
  layout: LabelLayout = 'LAYOUT_10x15',
  orientation: LabelOrientation = 'LANDSCAPE'
): Promise<Blob> {
  const params = new URLSearchParams({ layout, labelOrientation: orientation });
  parcelIds.forEach((id) => params.append('parcelIds', String(id)));

  const accessToken = await getAccessToken();

  const response = await fetch(`${UNISEND_API_URL}/api/v2/label?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new UnisendApiError('Failed to generate label', response.status);
  }

  return response.blob();
}

/**
 * Get tracking events for a barcode
 */
export async function getTrackingEvents(
  barcode: string,
  lang: 'en' | 'lt' = 'en'
): Promise<TrackingEvent[]> {
  return apiRequest<TrackingEvent[]>(`/api/v2/tracking/${barcode}/events`, {
    headers: {
      'Accept-Language': lang,
    },
  });
}

// ============================================
// Convenience Methods
// ============================================

/**
 * Create parcel and initiate shipping in one call
 * Returns barcode and tracking info
 */
export async function createAndShipParcel(
  data: CreateParcelRequest
): Promise<{
  parcelId: number;
  barcode: string;
  trackingUrl?: string;
}> {
  // Create parcel
  const parcelResponse = await createParcel(data);

  // Initiate shipping
  const shippingResponse = await initiateShipping({ parcelIds: [parcelResponse.parcelId] });

  // Check if barcode is in shipping response
  const parcelFromShipping = shippingResponse.parcels?.find(p => p.parcelId === parcelResponse.parcelId);
  if (parcelFromShipping?.barcode || parcelFromShipping?.trackingNumber) {
    return {
      parcelId: parcelResponse.parcelId,
      barcode: parcelFromShipping.barcode || parcelFromShipping.trackingNumber || '',
      trackingUrl: parcelFromShipping.trackingUrl,
    };
  }

  // Try to get barcode from parcel details
  const barcodes = await getBarcodes([parcelResponse.parcelId]);

  return {
    parcelId: parcelResponse.parcelId,
    barcode: barcodes[0]?.barcode || '',
    trackingUrl: barcodes[0]?.trackingUrl,
  };
}

/**
 * Clear terminal cache (useful for testing or manual refresh)
 */
export async function clearTerminalCache(): Promise<void> {
  const { cacheDel } = await import('@/lib/cache');
  const countries: TerminalCountry[] = ['LT', 'LV', 'EE'];
  await Promise.all([
    ...countries.map((c) => cacheDel(`unisend:terminals:${c}`)),
    cacheDel('unisend:terminals:all'),
  ]).catch(() => {});
}

/**
 * Clear token cache (useful for testing)
 */
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
  generateLabel,
  getTrackingEvents,
  createAndShipParcel,
  clearTerminalCache,
  clearTokenCache,
};

export type UnisendClient = typeof unisendClient;

export function getUnisendClient(): UnisendClient {
  return unisendClient;
}

export default unisendClient;
