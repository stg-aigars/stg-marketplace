/**
 * Unified order timeline builder.
 * Merges order milestones and tracking events into a single sorted list.
 */

import type { TrackingStateType } from '@/lib/services/unisend/types';
import type { CancellationReason } from './types';

// ─── Types ───────────────────────────────────────────────────

export type TimelineEntryType = 'order_milestone' | 'tracking_event';

export type OrderMilestone =
  | 'ordered'
  | 'accepted'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'refunded';

export interface TimelineEntry {
  type: TimelineEntryType;
  key: OrderMilestone | TrackingStateType;
  timestamp: string | null;
  location?: string;
  detail?: string;
  isCurrent: boolean;
  isFuture: boolean;
}

// ─── Constants ───────────────────────────────────────────────

const CANCELLATION_LABELS: Record<CancellationReason, string> = {
  declined: 'The seller declined this order',
  response_timeout: "The seller didn't respond in time",
  shipping_timeout: 'Shipping could not be completed',
  system: 'Cancelled automatically',
};

const TERMINAL_STATUSES = new Set(['cancelled', 'disputed', 'refunded']);

// ─── Builder ─────────────────────────────────────────────────

export interface OrderForTimeline {
  status: string;
  created_at: string;
  accepted_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  disputed_at?: string | null;
  refunded_at?: string | null;
  cancellation_reason?: CancellationReason | null;
}

export interface TrackingEventForTimeline {
  state_type: string;
  event_timestamp: string;
  location?: string | null;
}

export function buildOrderTimeline(
  order: OrderForTimeline,
  trackingEvents: TrackingEventForTimeline[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const hasTracking = trackingEvents.length > 0;
  const isTerminal = TERMINAL_STATUSES.has(order.status);

  // 1. Always add "ordered"
  entries.push(milestone('ordered', order.created_at));

  // 2. Add "accepted" if it happened
  if (order.accepted_at) {
    entries.push(milestone('accepted', order.accepted_at));
  }

  // 3. Middle phase: tracking events vs order milestones
  if (hasTracking) {
    for (const event of trackingEvents) {
      entries.push({
        type: 'tracking_event',
        key: event.state_type as TrackingStateType,
        timestamp: event.event_timestamp,
        location: event.location ?? undefined,
        isCurrent: false,
        isFuture: false,
      });
    }
  } else {
    if (order.shipped_at) {
      entries.push(milestone('shipped', order.shipped_at, 'Waiting for tracking updates'));
    }
    if (order.delivered_at) {
      entries.push(milestone('delivered', order.delivered_at));
    }
  }

  // 4. Terminal states
  if (order.completed_at) {
    entries.push(milestone('completed', order.completed_at));
  }
  if (order.cancelled_at) {
    const reason = order.cancellation_reason;
    const detail = reason ? CANCELLATION_LABELS[reason] : undefined;
    entries.push(milestone('cancelled', order.cancelled_at, detail));
  }
  if (order.disputed_at) {
    entries.push(milestone('disputed', order.disputed_at));
  }
  if (order.refunded_at) {
    entries.push(milestone('refunded', order.refunded_at));
  }

  // 5. Future steps (one max, happy path only)
  if (!isTerminal) {
    const futureEntry = getFutureStep(order.status, hasTracking, trackingEvents);
    if (futureEntry) {
      entries.push(futureEntry);
    }
  }

  // 6. Sort chronologically; future entries (null timestamp) sort last
  entries.sort((a, b) => {
    if (a.timestamp === null && b.timestamp === null) return 0;
    if (a.timestamp === null) return 1;
    if (b.timestamp === null) return -1;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  // 7. Mark isCurrent on last non-future entry
  const lastPastIndex = entries.findLastIndex((e) => !e.isFuture);
  if (lastPastIndex >= 0) {
    entries[lastPastIndex].isCurrent = true;
  }

  return entries;
}

// ─── Helpers ─────────────────────────────────────────────────

function milestone(key: OrderMilestone, timestamp: string, detail?: string): TimelineEntry {
  return {
    type: 'order_milestone',
    key,
    timestamp,
    detail,
    isCurrent: false,
    isFuture: false,
  };
}

function future(key: OrderMilestone): TimelineEntry {
  return {
    type: 'order_milestone',
    key,
    timestamp: null,
    isCurrent: false,
    isFuture: true,
  };
}

function getFutureStep(
  status: string,
  hasTracking: boolean,
  trackingEvents: TrackingEventForTimeline[]
): TimelineEntry | null {
  switch (status) {
    case 'pending_seller':
      return future('accepted');

    case 'accepted':
      if (!hasTracking) return future('shipped');
      // If only LABEL_CREATED, no future — next real event will appear when it happens
      if (trackingEvents.every((e) => e.state_type === 'LABEL_CREATED')) return null;
      return future('completed');

    case 'shipped':
      return future('completed');

    case 'delivered':
      return future('completed');

    default:
      return null;
  }
}
