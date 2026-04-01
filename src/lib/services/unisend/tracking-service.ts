/**
 * Unisend Tracking Sync Service
 * Fetches tracking events from Unisend and updates order status.
 * Auto-transitions:
 *   - PARCEL_RECEIVED + accepted → shipped (hybrid auto-ship)
 *   - PARCEL_DELIVERED + shipped → delivered
 */

import { getUnisendClient } from './client';
import { createServiceClient } from '@/lib/supabase';
import type { TrackingStateType } from './types';
import { sendOrderDeliveredToBuyer, sendOrderShippedToBuyer } from '@/lib/email';
import { logAuditEvent } from '@/lib/services/audit';
import { notify } from '@/lib/notifications';

/** Max age for PARCEL_RECEIVED events to trigger auto-ship (prevents stale transitions) */
const AUTO_SHIP_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

interface SyncResult {
  success: boolean;
  newEventsCount: number;
  statusChanged: boolean;
  oldStatus?: string;
  newStatus?: string;
  error?: string;
}

/**
 * Sync tracking events for a single order
 */
export async function syncTrackingForOrder(
  orderId: string,
  barcode: string
): Promise<SyncResult> {
  try {
    const unisend = getUnisendClient();
    const supabase = createServiceClient();

    const trackingEvents = await unisend.getTrackingEvents(barcode);

    if (!trackingEvents || trackingEvents.length === 0) {
      return { success: true, newEventsCount: 0, statusChanged: false };
    }

    const { data: order } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (!order) {
      return { success: false, error: 'Order not found', newEventsCount: 0, statusChanged: false };
    }

    const oldStatus = order.status;
    let newEventsCount = 0;

    for (const event of trackingEvents) {
      const { data: wasInserted, error } = await supabase.rpc('add_tracking_event', {
        p_order_id: orderId,
        p_event_type: event.eventType,
        p_state_type: event.stateType,
        p_state_text: event.stateText,
        p_location: event.location || null,
        p_description: event.description || event.stateText,
        p_event_timestamp: event.timestamp,
      });

      if (error) {
        console.error('[Tracking] Error inserting event:', error);
      } else if (wasInserted) {
        newEventsCount++;
      }
    }

    // Auto-transition: if PARCEL_DELIVERED detected and order is shipped → delivered
    const hasDeliveryEvent = trackingEvents.some(
      (e) => (e.stateType as TrackingStateType) === 'PARCEL_DELIVERED'
    );

    let statusChanged = false;
    let newStatus = oldStatus;

    if (hasDeliveryEvent && oldStatus === 'shipped') {
      const { data: delivered, error: deliverError } = await supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('status', 'shipped') // Optimistic lock
        .select('*, listings(game_name), buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, email)')
        .single();

      if (delivered && !deliverError) {
        statusChanged = true;
        newStatus = 'delivered';

        void logAuditEvent({
          actorType: 'cron',
          action: 'order.status_changed',
          resourceType: 'order',
          resourceId: orderId,
          metadata: { from: 'shipped', to: 'delivered', trigger: 'tracking_parcel_delivered' },
        });

        // Notify buyer — this is their signal that the 2-day dispute window has started
        const buyerProfile = delivered.buyer_profile as { full_name?: string; email?: string } | null;
        const listing = delivered.listings as { game_name?: string } | null;
        if (buyerProfile?.email) {
          sendOrderDeliveredToBuyer({
            buyerName: buyerProfile.full_name ?? 'Buyer',
            buyerEmail: buyerProfile.email,
            orderNumber: delivered.order_number,
            orderId,
            gameName: listing?.game_name ?? 'Game',
          }).catch((err) => console.error('[Email] Failed to send auto-delivery email:', err));
        }

        void notify(delivered.buyer_id, 'order.delivered', {
          gameName: listing?.game_name ?? 'Game',
          orderNumber: delivered.order_number,
          orderId,
        });

        console.log(`[Tracking] Auto-delivered order ${orderId} via PARCEL_DELIVERED`);
      }
    }

    // Auto-transition: if PARCEL_RECEIVED detected and order is accepted → shipped
    // Guard: only act on recent events to prevent stale transitions after deploy
    const receivedEvent = trackingEvents.find(
      (e) =>
        (e.stateType as TrackingStateType) === 'PARCEL_RECEIVED' &&
        Date.now() - new Date(e.timestamp).getTime() < AUTO_SHIP_MAX_AGE_MS
    );

    if (receivedEvent && (statusChanged ? newStatus : oldStatus) === 'accepted') {
      const { data: shipped, error: shipError } = await supabase
        .from('orders')
        .update({
          status: 'shipped',
          shipped_at: new Date().toISOString(),
          deadline_reminder_sent_at: null,
        })
        .eq('id', orderId)
        .eq('status', 'accepted') // Optimistic lock
        .select('*, listings(game_name), buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, email)')
        .single();

      if (shipped && !shipError) {
        statusChanged = true;
        newStatus = 'shipped';

        void logAuditEvent({
          actorType: 'cron',
          action: 'order.status_changed',
          resourceType: 'order',
          resourceId: orderId,
          metadata: { from: 'accepted', to: 'shipped', trigger: 'tracking_parcel_received' },
        });

        const buyerProfile = shipped.buyer_profile as { full_name?: string; email?: string } | null;
        const listing = shipped.listings as { game_name?: string } | null;
        const terminalName = receivedEvent.location || undefined;

        if (buyerProfile?.email) {
          sendOrderShippedToBuyer({
            buyerName: buyerProfile.full_name ?? 'Buyer',
            buyerEmail: buyerProfile.email,
            orderNumber: shipped.order_number,
            orderId,
            gameName: listing?.game_name ?? 'Game',
            barcode: shipped.barcode ?? undefined,
            trackingUrl: shipped.tracking_url ?? undefined,
            terminalName,
          }).catch((err) => console.error('[Email] Failed to send auto-ship email:', err));
        }

        void notify(shipped.buyer_id, 'shipping.scanned', {
          gameName: listing?.game_name ?? 'Game',
          orderNumber: shipped.order_number,
          orderId,
          terminalName: terminalName,
        });

        console.log(`[Tracking] Auto-shipped order ${orderId} via PARCEL_RECEIVED at ${terminalName ?? 'unknown terminal'}`);
      }
    }

    return {
      success: true,
      newEventsCount,
      statusChanged,
      oldStatus: statusChanged ? oldStatus : undefined,
      newStatus: statusChanged ? newStatus : undefined,
    };
  } catch (error: unknown) {
    console.error('[Tracking] Error syncing tracking:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      newEventsCount: 0,
      statusChanged: false,
    };
  }
}

/**
 * Sync tracking for all active T2T orders.
 * Called by cron job.
 */
export async function syncAllActiveOrders(): Promise<{
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  statusChanges: Array<{ orderId: string; orderNumber: string; oldStatus: string; newStatus: string }>;
}> {
  const supabase = createServiceClient();

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, barcode, status')
    .eq('shipping_method', 'unisend_t2t')
    .not('barcode', 'is', null)
    .in('status', ['accepted', 'shipped']);

  if (error || !orders) {
    console.error('[Tracking] Error fetching orders:', error);
    return { totalProcessed: 0, successCount: 0, errorCount: 0, statusChanges: [] };
  }

  let successCount = 0;
  let errorCount = 0;
  const statusChanges: Array<{ orderId: string; orderNumber: string; oldStatus: string; newStatus: string }> = [];

  for (const order of orders) {
    const result = await syncTrackingForOrder(order.id, order.barcode!);

    if (result.success) {
      successCount++;

      if (result.statusChanged && result.oldStatus && result.newStatus) {
        statusChanges.push({
          orderId: order.id,
          orderNumber: order.order_number,
          oldStatus: result.oldStatus,
          newStatus: result.newStatus,
        });
      }
    } else {
      errorCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return {
    totalProcessed: orders.length,
    successCount,
    errorCount,
    statusChanges,
  };
}
