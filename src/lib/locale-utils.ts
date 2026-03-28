import { routing } from '@/i18n/routing';

/** Strip the locale prefix (e.g. /en, /lv) from a pathname for route matching. */
export function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split('/');
  if (segments.length > 1 && routing.locales.includes(segments[1] as (typeof routing.locales)[number])) {
    return '/' + segments.slice(2).join('/') || '/';
  }
  return pathname;
}
