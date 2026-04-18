import 'server-only';

import { headers } from 'next/headers';
import type { AnalyticsEventMap, AnalyticsEventName } from './types';
import { getPostHogServer } from './posthog-server';
import { isBotUserAgent } from './bot-detection';

export async function trackServer<K extends AnalyticsEventName>(
  event: K,
  distinctId: string,
  properties: AnalyticsEventMap[K],
): Promise<void> {
  try {
    const h = await headers();
    if (isBotUserAgent(h.get('user-agent'))) return;
  } catch {
    // headers() can throw outside a request scope — fall through and capture
  }

  const client = getPostHogServer();
  if (!client) return;
  try {
    client.capture({ event, distinctId, properties });
  } catch (err) {
    console.error('[analytics] trackServer capture failed', err);
  } finally {
    try {
      await client.shutdown();
    } catch (err) {
      console.error('[analytics] trackServer shutdown failed', err);
    }
  }
}
