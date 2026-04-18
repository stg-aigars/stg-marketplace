import { PostHog } from 'posthog-node';
import { env } from '@/lib/env';

// TODO(scale): on a long-running VPS this creates a PostHog client per event,
// then awaits shutdown. At low volume that's fine and simple. When we cross
// ~1k server events/day, swap for a singleton with flushAt: 10,
// flushInterval: 5000, and a SIGTERM shutdown hook.
export function getPostHogServer(): PostHog | null {
  if (!env.posthog.key) return null;
  return new PostHog(env.posthog.key, {
    host: env.posthog.host,
    flushAt: 1,
    flushInterval: 0,
  });
}
