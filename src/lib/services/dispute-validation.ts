/**
 * Pure dispute validation functions.
 * No side effects, no DB access — safe to import in tests.
 */

import { DISPUTE_WINDOW_DAYS, DISPUTE_NEGOTIATION_DAYS } from '@/lib/pricing/constants';
import type { OrderRow, DisputeRow } from '@/lib/orders/types';

interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Can the buyer open a dispute on this order?
 * Must be buyer, order must be delivered, within 2-day window.
 */
export function canOpenDispute(
  order: Pick<OrderRow, 'status' | 'buyer_id' | 'delivered_at'>,
  userId: string,
  now: Date = new Date()
): ValidationResult {
  if (order.buyer_id !== userId) {
    return { allowed: false, reason: 'Only the buyer can open a dispute' };
  }
  if (order.status !== 'delivered') {
    return { allowed: false, reason: 'Disputes can only be opened on delivered orders' };
  }
  if (!order.delivered_at) {
    return { allowed: false, reason: 'Order has no delivery timestamp' };
  }
  const windowEnd = new Date(order.delivered_at);
  windowEnd.setDate(windowEnd.getDate() + DISPUTE_WINDOW_DAYS);
  if (now >= windowEnd) {
    return { allowed: false, reason: 'The dispute window has expired' };
  }
  return { allowed: true };
}

/**
 * Can this user escalate the dispute to staff?
 * Must be buyer or seller, dispute open, not already escalated, 7+ days old.
 */
export function canEscalateDispute(
  dispute: Pick<DisputeRow, 'buyer_id' | 'seller_id' | 'escalated_at' | 'resolved_at' | 'created_at'>,
  userId: string,
  now: Date = new Date()
): ValidationResult {
  if (userId !== dispute.buyer_id && userId !== dispute.seller_id) {
    return { allowed: false, reason: 'Only the buyer or seller can escalate' };
  }
  if (dispute.resolved_at) {
    return { allowed: false, reason: 'Dispute is already resolved' };
  }
  if (dispute.escalated_at) {
    return { allowed: false, reason: 'Dispute is already escalated' };
  }
  const escalationDate = new Date(dispute.created_at);
  escalationDate.setDate(escalationDate.getDate() + DISPUTE_NEGOTIATION_DAYS);
  if (now < escalationDate) {
    return { allowed: false, reason: 'Escalation is available after 7 days of negotiation' };
  }
  return { allowed: true };
}

/**
 * Can the buyer withdraw this dispute?
 * Must be buyer, dispute open, not escalated.
 */
export function canWithdrawDispute(
  dispute: Pick<DisputeRow, 'buyer_id' | 'escalated_at' | 'resolved_at'>,
  userId: string
): ValidationResult {
  if (userId !== dispute.buyer_id) {
    return { allowed: false, reason: 'Only the buyer can withdraw a dispute' };
  }
  if (dispute.resolved_at) {
    return { allowed: false, reason: 'Dispute is already resolved' };
  }
  if (dispute.escalated_at) {
    return { allowed: false, reason: 'Cannot withdraw an escalated dispute' };
  }
  return { allowed: true };
}
