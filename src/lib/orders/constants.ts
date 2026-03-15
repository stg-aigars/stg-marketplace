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
