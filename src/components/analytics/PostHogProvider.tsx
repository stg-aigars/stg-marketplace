'use client';

import { PostHogProvider as PHProvider } from 'posthog-js/react';
import type { ReactNode } from 'react';
import { getPostHogClient } from '@/lib/analytics/posthog-client';

export function PostHogProvider({ children }: { children: ReactNode }) {
  const client = getPostHogClient();
  if (!client) return <>{children}</>;
  return <PHProvider client={client}>{children}</PHProvider>;
}
