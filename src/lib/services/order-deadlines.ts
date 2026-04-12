/**
 * Order deadline enforcement service.
 * Called by the enforce-deadlines cron every 2 hours.
 *
 * Job ordering matters: timeouts run BEFORE reminders so an order at 49h
 * gets auto-declined, not reminded then immediately declined in the same run.
 */

import { createServiceClient } from '@/lib/supabase';
import { refundOrder } from '@/lib/services/order-refund';
import { logAuditEvent } from '@/lib/services/audit';
import {
  SELLER_RESPONSE_DEADLINE_HOURS,
  SELLER_RESPONSE_REMINDER_HOURS,
  SHIPPING_DEADLINE_DAYS,
  SHIPPING_REMINDER_DAYS,
  DELIVERY_REMINDER_DAYS,
  DELIVERY_ESCALATION_DAYS,
} from '@/lib/orders/constants';
import {
  sendSellerResponseReminder,
  sendOrderAutoCancelledToBuyer,
  sendOrderAutoCancelledToSeller,
  sendShippingReminderToSeller,
  sendDeliveryReminderToBuyer,
  sendDisputeEscalated,
} from '@/lib/email';
import { notify, notifyMany } from '@/lib/notifications';
import type { PaymentMethod } from '@/lib/orders/types';
import { getOrderGameSummary } from '@/lib/orders/utils';

const BATCH_LIMIT = 50;

export interface DeadlineEnforcementResult {
  pendingSellerAutoDeclined: number;
  pendingSellerReminders: number;
  shippingAutoCancelled: number;
  shippingReminders: number;
  deliveryReminders: number;
  deliveryEscalations: number;
  errors: string[];
}

export async function enforceOrderDeadlines(): Promise<DeadlineEnforcementResult> {
  const result: DeadlineEnforcementResult = {
    pendingSellerAutoDeclined: 0,
    pendingSellerReminders: 0,
    shippingAutoCancelled: 0,
    shippingReminders: 0,
    deliveryReminders: 0,
    deliveryEscalations: 0,
    errors: [],
  };

  const supabase = createServiceClient();

  // Job 1: Auto-decline pending_seller orders past deadline
  await autoCancelOrders({
    supabase,
    result,
    status: 'pending_seller',
    timestampColumn: 'created_at',
    deadlineHours: SELLER_RESPONSE_DEADLINE_HOURS,
    reason: 'response_timeout',
    counterKey: 'pendingSellerAutoDeclined',
  });

  // Job 2: Send pending_seller reminders
  await sendReminders({
    supabase,
    result,
    status: 'pending_seller',
    timestampColumn: 'created_at',
    reminderAfterHours: SELLER_RESPONSE_REMINDER_HOURS,
    deadlineHours: SELLER_RESPONSE_DEADLINE_HOURS,
    counterKey: 'pendingSellerReminders',
    sendEmail: async (order, profiles) => {
      await sendSellerResponseReminder({
        sellerName: profiles.seller?.full_name ?? 'Seller',
        sellerEmail: profiles.seller?.email ?? '',
        orderNumber: order.order_number,
        orderId: order.id,
        gameName: order.game_name,
        buyerName: profiles.buyer?.full_name ?? 'Buyer',
        hoursRemaining: SELLER_RESPONSE_DEADLINE_HOURS - SELLER_RESPONSE_REMINDER_HOURS,
      });
    },
  });

  // Job 3: Auto-cancel accepted orders past shipping deadline
  await autoCancelOrders({
    supabase,
    result,
    status: 'accepted',
    timestampColumn: 'accepted_at',
    deadlineHours: SHIPPING_DEADLINE_DAYS * 24,
    reason: 'shipping_timeout',
    counterKey: 'shippingAutoCancelled',
  });

  // Job 4: Send shipping reminders
  await sendReminders({
    supabase,
    result,
    status: 'accepted',
    timestampColumn: 'accepted_at',
    reminderAfterHours: SHIPPING_REMINDER_DAYS * 24,
    deadlineHours: SHIPPING_DEADLINE_DAYS * 24,
    counterKey: 'shippingReminders',
    sendEmail: async (order, profiles) => {
      await sendShippingReminderToSeller({
        sellerName: profiles.seller?.full_name ?? 'Seller',
        sellerEmail: profiles.seller?.email ?? '',
        orderNumber: order.order_number,
        orderId: order.id,
        gameName: order.game_name,
        daysRemaining: SHIPPING_DEADLINE_DAYS - SHIPPING_REMINDER_DAYS,
      });
    },
  });

  // Job 5a: Send delivery reminders (14 days)
  await sendReminders({
    supabase,
    result,
    status: 'shipped',
    timestampColumn: 'shipped_at',
    reminderAfterHours: DELIVERY_REMINDER_DAYS * 24,
    deadlineHours: DELIVERY_ESCALATION_DAYS * 24,
    counterKey: 'deliveryReminders',
    sendEmail: async (order, profiles) => {
      const shippedAt = order.shipped_at ? new Date(order.shipped_at) : new Date(order.created_at);
      const daysSinceShipped = Math.floor((Date.now() - shippedAt.getTime()) / (1000 * 60 * 60 * 24));
      await sendDeliveryReminderToBuyer({
        buyerName: profiles.buyer?.full_name ?? 'Buyer',
        buyerEmail: profiles.buyer?.email ?? '',
        orderNumber: order.order_number,
        orderId: order.id,
        gameName: order.game_name,
        daysSinceShipped,
      });
    },
  });

  // Job 5b: Escalate shipped orders past 21 days (create dispute)
  await escalateStaleShippedOrders(supabase, result);

  return result;
}

// --- Shared helpers ---

interface OrderWithProfiles {
  id: string;
  order_number: string;
  listing_id: string | null;
  buyer_id: string;
  seller_id: string;
  status: string;
  total_amount_cents: number;
  buyer_wallet_debit_cents: number;
  payment_method: string | null;
  everypay_payment_reference: string | null;
  refund_status: string | null;
  game_name: string;
  listing_ids: string[];
  created_at: string;
  accepted_at: string | null;
  shipped_at: string | null;
  buyer_profile: { full_name: string | null; email: string | null } | null;
  seller_profile: { full_name: string | null; email: string | null } | null;
}

const ORDER_SELECT = `
  id, order_number, listing_id, buyer_id, seller_id, status,
  total_amount_cents, buyer_wallet_debit_cents, payment_method,
  everypay_payment_reference, refund_status, created_at, accepted_at, shipped_at,
  order_items(listing_id, listings(game_name)),
  listings(game_name),
  buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, email),
  seller_profile:user_profiles!orders_seller_id_fkey(full_name, email)
`;

function mapOrder(row: Record<string, unknown>): OrderWithProfiles {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderItems = (row.order_items as any[]) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listings = row.listings as any;

  const gameName = getOrderGameSummary(orderItems, listings);

  // Collect all listing IDs from order_items (or fall back to legacy listing_id)
  const listingIds = orderItems.length > 0
    ? orderItems.map((i: { listing_id: string }) => i.listing_id)
    : row.listing_id ? [row.listing_id as string] : [];

  return {
    ...row,
    game_name: gameName,
    listing_ids: listingIds,
  } as OrderWithProfiles;
}

interface AutoCancelParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  result: DeadlineEnforcementResult;
  status: 'pending_seller' | 'accepted';
  timestampColumn: string;
  deadlineHours: number;
  reason: 'response_timeout' | 'shipping_timeout';
  counterKey: 'pendingSellerAutoDeclined' | 'shippingAutoCancelled';
}

async function autoCancelOrders(params: AutoCancelParams): Promise<void> {
  const { supabase, result, status, timestampColumn, deadlineHours, reason, counterKey } = params;
  const cutoff = new Date(Date.now() - deadlineHours * 60 * 60 * 1000).toISOString();

  const { data: orders } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('status', status)
    .lt(timestampColumn, cutoff)
    .limit(BATCH_LIMIT);

  if (!orders || orders.length === 0) return;

  for (const raw of orders) {
    const order = mapOrder(raw);
    try {
      // Cancel with optimistic lock
      const { data: cancelled } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason,
        })
        .eq('id', order.id)
        .eq('status', status)
        .select('id')
        .single();

      if (!cancelled) continue; // Race: already transitioned

      // Restore all listings in this order
      if (order.listing_ids.length > 0) {
        await supabase
          .from('listings')
          .update({ status: 'active', reserved_at: null, reserved_by: null })
          .in('id', order.listing_ids)
          .in('status', ['reserved', 'sold']);

        // Mark order_items as inactive (frees partial unique index for re-listing)
        await supabase
          .from('order_items')
          .update({ active: false })
          .eq('order_id', order.id);
      }

      // Refund
      await refundOrder(order.id, {
        buyer_id: order.buyer_id,
        total_amount_cents: order.total_amount_cents,
        buyer_wallet_debit_cents: order.buyer_wallet_debit_cents,
        payment_method: order.payment_method as PaymentMethod | null,
        everypay_payment_reference: order.everypay_payment_reference,
        order_number: order.order_number,
        refund_status: order.refund_status,
      });

      void logAuditEvent({
        actorType: 'cron',
        action: `order.auto_cancelled.${reason}`,
        resourceType: 'order',
        resourceId: order.id,
        metadata: { orderNumber: order.order_number, reason },
      });

      // Emails (non-blocking)
      const buyerEmail = order.buyer_profile?.email;
      const sellerEmail = order.seller_profile?.email;
      if (buyerEmail) {
        void sendOrderAutoCancelledToBuyer({
          buyerName: order.buyer_profile?.full_name ?? 'Buyer',
          buyerEmail, orderNumber: order.order_number,
          orderId: order.id, gameName: order.game_name, reason,
          paymentMethod: order.payment_method,
        });
      }
      if (sellerEmail) {
        void sendOrderAutoCancelledToSeller({
          sellerName: order.seller_profile?.full_name ?? 'Seller',
          sellerEmail, orderNumber: order.order_number,
          orderId: order.id, gameName: order.game_name, reason,
        });
      }

      void notifyMany([
        { userId: order.buyer_id, type: 'order.auto_cancelled', context: { gameName: order.game_name, orderNumber: order.order_number, orderId: order.id, reason } },
        { userId: order.seller_id, type: 'order.auto_cancelled', context: { gameName: order.game_name, orderNumber: order.order_number, orderId: order.id, reason } },
      ]);

      result[counterKey]++;
    } catch (err) {
      const msg = `Failed to auto-cancel order ${order.id}: ${err instanceof Error ? err.message : 'unknown'}`;
      console.error(`[Deadlines] ${msg}`);
      result.errors.push(msg);
    }
  }
}

interface SendReminderParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  result: DeadlineEnforcementResult;
  status: string;
  timestampColumn: string;
  reminderAfterHours: number;
  deadlineHours: number;
  counterKey: 'pendingSellerReminders' | 'shippingReminders' | 'deliveryReminders';
  sendEmail: (
    order: OrderWithProfiles,
    profiles: { buyer: OrderWithProfiles['buyer_profile']; seller: OrderWithProfiles['seller_profile'] }
  ) => Promise<void>;
}

async function sendReminders(params: SendReminderParams): Promise<void> {
  const { supabase, result, status, timestampColumn, reminderAfterHours, deadlineHours, counterKey, sendEmail } = params;
  const reminderCutoff = new Date(Date.now() - reminderAfterHours * 60 * 60 * 1000).toISOString();
  const deadlineCutoff = new Date(Date.now() - deadlineHours * 60 * 60 * 1000).toISOString();

  const { data: orders } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('status', status)
    .lt(timestampColumn, reminderCutoff)
    .gte(timestampColumn, deadlineCutoff)
    .is('deadline_reminder_sent_at', null)
    .limit(BATCH_LIMIT);

  if (!orders || orders.length === 0) return;

  for (const raw of orders) {
    const order = mapOrder(raw);
    try {
      // Mark reminder sent (optimistic lock on IS NULL)
      const { data: updated } = await supabase
        .from('orders')
        .update({ deadline_reminder_sent_at: new Date().toISOString() })
        .eq('id', order.id)
        .is('deadline_reminder_sent_at', null)
        .select('id')
        .single();

      if (!updated) continue; // Already sent by another cron run

      await sendEmail(order, {
        buyer: order.buyer_profile,
        seller: order.seller_profile,
      });

      // In-app notification for reminders
      const reminderTypeMap: Record<string, 'order.reminder.response' | 'order.reminder.shipping' | 'order.reminder.delivery'> = {
        pendingSellerReminders: 'order.reminder.response',
        shippingReminders: 'order.reminder.shipping',
        deliveryReminders: 'order.reminder.delivery',
      };
      const reminderType = reminderTypeMap[counterKey];
      if (reminderType) {
        const targetUserId = counterKey === 'deliveryReminders' ? order.buyer_id : order.seller_id;
        void notify(targetUserId, reminderType, {
          gameName: order.game_name,
          orderNumber: order.order_number,
          orderId: order.id,
        });
      }

      result[counterKey]++;
    } catch (err) {
      const msg = `Failed to send reminder for order ${order.id}: ${err instanceof Error ? err.message : 'unknown'}`;
      console.error(`[Deadlines] ${msg}`);
      result.errors.push(msg);
    }
  }
}

async function escalateStaleShippedOrders(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  result: DeadlineEnforcementResult
): Promise<void> {
  const cutoff = new Date(Date.now() - DELIVERY_ESCALATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: orders } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('status', 'shipped')
    .lt('shipped_at', cutoff)
    .limit(BATCH_LIMIT);

  if (!orders || orders.length === 0) return;

  for (const raw of orders) {
    const order = mapOrder(raw);
    try {
      // Check if dispute already exists (idempotency)
      const { data: existingDispute } = await supabase
        .from('disputes')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle();

      if (existingDispute) continue;

      // Transition to disputed with optimistic lock
      const { data: updated } = await supabase
        .from('orders')
        .update({
          status: 'disputed',
          disputed_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('status', 'shipped')
        .select('id')
        .single();

      if (!updated) continue;

      // Create dispute
      await supabase
        .from('disputes')
        .insert({
          order_id: order.id,
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          reason: 'Auto-escalated: no delivery confirmation after 21 days',
          photos: [],
          escalated_at: new Date().toISOString(),
        });

      void logAuditEvent({
        actorType: 'cron',
        action: 'order.delivery_escalated',
        resourceType: 'order',
        resourceId: order.id,
        metadata: { orderNumber: order.order_number },
      });

      // Notify both parties + staff
      void sendDisputeEscalated({
        buyerName: order.buyer_profile?.full_name ?? 'Buyer',
        buyerEmail: order.buyer_profile?.email ?? '',
        sellerName: order.seller_profile?.full_name ?? 'Seller',
        sellerEmail: order.seller_profile?.email ?? '',
        orderNumber: order.order_number,
        orderId: order.id,
        gameName: order.game_name,
      }).catch((err) => console.error('[Deadlines] Failed to send escalation email:', err));

      void notifyMany([
        { userId: order.buyer_id, type: 'order.escalated', context: { gameName: order.game_name, orderNumber: order.order_number, orderId: order.id } },
        { userId: order.seller_id, type: 'order.escalated', context: { gameName: order.game_name, orderNumber: order.order_number, orderId: order.id } },
      ]);

      result.deliveryEscalations++;
    } catch (err) {
      const msg = `Failed to escalate order ${order.id}: ${err instanceof Error ? err.message : 'unknown'}`;
      console.error(`[Deadlines] ${msg}`);
      result.errors.push(msg);
    }
  }
}
