// Client-safe barrel. Import trackServer directly from
// '@/lib/analytics/track-server' — it pulls in next/headers and is guarded by
// 'server-only' so it would poison any client bundle it touched.
export { trackClient } from './track-client';
export type { AnalyticsEventMap, AnalyticsEventName } from './types';
