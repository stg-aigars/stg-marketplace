'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { usePostHog } from 'posthog-js/react';
import { useEffect } from 'react';

// Known quirk: locale-prefixed paths like /en/browse and (future) /lv/browse
// become two distinct PostHog URLs. Acceptable at launch (English only); when
// Latvian lands, either strip the leading /[locale] before capture or set a
// separate $locale property and group by it in dashboards.
export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog || !pathname) return;
    const qs = searchParams?.toString();
    const url = `${window.location.origin}${pathname}${qs ? `?${qs}` : ''}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams, posthog]);

  return null;
}
