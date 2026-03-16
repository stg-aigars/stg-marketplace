/**
 * Unisend Tracking Sync Service
 * Fetches tracking events from Unisend and updates order status
 */

import { getUnisendClient } from './client';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Fetch tracking events from Unisend
    const trackingEvents = await unisend.getTrackingEvents(barcode);

    if (!trackingEvents || trackingEvents.length === 0) {
      return { success: true, newEventsCount: 0, statusChanged: false };
    }

    // Get current order status
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

    // Insert tracking events using the existing database function
    // This function also updates order status based on state_type
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

    // Check if status changed
    const { data: updatedOrder } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    const statusChanged = !!updatedOrder && updatedOrder.status !== oldStatus;
    const newStatus = updatedOrder?.status || oldStatus;

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
 * Sync tracking for all active T2T orders
 * Called by cron job
 */
export async function syncAllActiveOrders(): Promise<{
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  statusChanges: Array<{ orderId: string; orderNumber: string; oldStatus: string; newStatus: string }>;
}> {
  // Get all T2T orders that have tracking but aren't completed/cancelled/disputed
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, barcode, status')
    .eq('shipping_method', 't2t')
    .not('barcode', 'is', null)
    .in('status', ['accepted', 'shipped', 'in_transit']);

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

    // Small delay to avoid rate limiting (Unisend API)
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return {
    totalProcessed: orders.length,
    successCount,
    errorCount,
    statusChanges,
  };
}
