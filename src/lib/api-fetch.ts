/** Fetch wrapper that auto-includes the X-Requested-With CSRF header. */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
}
