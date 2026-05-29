import type { AnalyticsEventMap, AnalyticsEventName } from './types';
import { getPostHogClient } from './posthog-client';

export function trackClient<K extends AnalyticsEventName>(
  event: K,
  properties: AnalyticsEventMap[K],
): void {
  try {
    const ph = getPostHogClient();
    if (!ph) return;
    ph.capture(event, properties);
  } catch (err) {
    console.error('[analytics] trackClient failed', err);
  }
}
