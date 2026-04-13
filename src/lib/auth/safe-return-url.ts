/** Prevent open redirects — only allow relative paths. */
export function safeReturnUrl(url?: string | null): string {
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return '/';
  }
  return url;
}
