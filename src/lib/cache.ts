/**
 * In-memory cache with TTL
 *
 * Simple Map-based cache for serverless environments.
 * Supports TTL expiration, periodic cleanup, and max entry eviction.
 */

const store = new Map<string, { data: string; expiresAt: number }>();
const MAX_ENTRIES = 500;
let cleanupCounter = 0;

/**
 * Get a cached value by key. Returns null if not found or expired.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const cached = store.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return JSON.parse(cached.data) as T;
  }
  if (cached) {
    store.delete(key);
  }
  return null;
}

/**
 * Set a cached value with TTL in seconds.
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const serialized = JSON.stringify(value);

  // Periodically purge expired entries to prevent unbounded growth
  cleanupCounter++;
  if (cleanupCounter >= 50) {
    cleanupCounter = 0;
    const now = Date.now();
    store.forEach((v, k) => {
      if (v.expiresAt <= now) store.delete(k);
    });
  }

  // Evict oldest entry if at capacity
  if (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }

  store.set(key, {
    data: serialized,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Delete a cached value by key.
 */
export async function cacheDel(key: string): Promise<void> {
  store.delete(key);
}
