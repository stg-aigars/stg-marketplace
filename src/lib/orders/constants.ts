/**
 * Order constants and UI configuration
 */

import type { OrderStatus } from './types';

/** Order number prefix */
export const ORDER_NUMBER_PREFIX = 'STG';

/** Status display configuration for UI */
export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badgeVariant: 'default' | 'success' | 'warning' | 'error' }
> = {
  pending_seller: { label: 'Awaiting seller', badgeVariant: 'warning' },
  accepted: { label: 'Accepted', badgeVariant: 'default' },
  shipped: { label: 'Shipped', badgeVariant: 'default' },
  delivered: { label: 'Delivered', badgeVariant: 'success' },
  completed: { label: 'Completed', badgeVariant: 'success' },
  cancelled: { label: 'Cancelled', badgeVariant: 'error' },
  disputed: { label: 'Disputed', badgeVariant: 'error' },
  refunded: { label: 'Refunded', badgeVariant: 'error' },
};

/** Valid status transitions in the order state machine */
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_seller: ['accepted', 'cancelled'],
  accepted: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['completed', 'disputed'],
  completed: [],
  cancelled: [],
  disputed: ['refunded', 'completed'],
  refunded: [],
};

/** Which role can perform each transition */
export const TRANSITION_ROLES: Record<string, 'buyer' | 'seller'> = {
  accepted: 'seller',
  cancelled: 'seller',
  shipped: 'seller',
  delivered: 'buyer',
  completed: 'buyer',
  disputed: 'buyer',
};

/** Timestamp column for each status */
export const STATUS_TIMESTAMP_COLUMN: Partial<Record<OrderStatus, string>> = {
  accepted: 'accepted_at',
  shipped: 'shipped_at',
  delivered: 'delivered_at',
  completed: 'completed_at',
  cancelled: 'cancelled_at',
  disputed: 'disputed_at',
  refunded: 'refunded_at',
};

/** Timeline steps in display order */
export const TIMELINE_STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'pending_seller', label: 'Ordered' },
  { status: 'accepted', label: 'Accepted' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'completed', label: 'Completed' },
];
