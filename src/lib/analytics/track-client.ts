import type { AnalyticsEventMap, AnalyticsEventName } from './types';
import { getPostHogClient } from './posthog-client';

interface TrackClientOptions {
  /** Force immediate send instead of batching. Use before client-side navigation. */
  sendInstantly?: boolean;
}

export function trackClient<K extends AnalyticsEventName>(
  event: K,
  properties: AnalyticsEventMap[K],
  options: TrackClientOptions = {},
): void {
  try {
    const ph = getPostHogClient();
    if (!ph) return;
    if (options.sendInstantly) {
      ph.capture(event, properties, { send_instantly: true });
    } else {
      ph.capture(event, properties);
    }
  } catch (err) {
    console.error('[analytics] trackClient failed', err);
  }
}
