/**
 * Thin fetch wrapper that auto-includes the X-Requested-With header
 * required by API routes for CSRF protection.
 *
 * Use this for ALL client-side fetch calls to /api/ routes.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    },
  });
}
