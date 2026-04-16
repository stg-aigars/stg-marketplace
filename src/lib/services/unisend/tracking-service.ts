/**
 * Unisend Tracking Sync Service
 * Fetches tracking events from Unisend and updates order status.
 * Auto-transitions:
 *   - PARCEL_RECEIVED + accepted → shipped (hybrid auto-ship)
 *   - PARCEL_DELIVERED + shipped → delivered
 *   - RETURNING + shipped → disputed (uncollected parcel, auto-dispute)
 */

import { getUnisendClient } from './client';
import type { TrackingEvent } from './types';
import { createServiceClient } from '@/lib/supabase';
import { sendOrderDeliveredToBuyer, sendOrderDeliveredToSeller, sendOrderShippedToBuyer, sendOrderShippedToSeller, sendDisputeEscalated } from '@/lib/email';
import { logAuditEvent } from '@/lib/services/audit';
import { notify, notifyMany } from '@/lib/notifications';
import { getOrderGameSummary, type OrderItemLike, type LegacyListingsLike } from '@/lib/orders/utils';

/** Max age for PARCEL_RECEIVED events to trigger auto-ship (prevents stale transitions) */
const AUTO_SHIP_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

/** Safety margin: re-fetch the last hour of events to let the idempotent RPC
 *  catch anything that failed to insert on the previous tick. Prevents silent
 *  event loss on transient errors without stalling the sync on persistent ones. */
const SYNC_SAFETY_MARGIN_MS = 60 * 60 * 1000; // 1 hour

interface SyncResult {
  success: boolean;
  newEventsCount: number;
  eventErrors: number;
  statusChanged: boolean;
  oldStatus?: string;
  newStatus?: string;
  error?: string;
}

interface OrderForTracking {
  id: string;
  order_number: string;
  barcode: string;
  status: string;
}

/**
 * Process pre-fetched tracking events for a single order.
 * Inserts events via RPC and handles auto-transitions.
 */
async function processOrderEvents(
  order: OrderForTracking,
  trackingEvents: TrackingEvent[]
): Promise<SyncResult> {
  if (!trackingEvents.length) {
    return { success: true, newEventsCount: 0, eventErrors: 0, statusChanged: false };
  }

  try {
    const supabase = createServiceClient();
    const orderId = order.id;
    const oldStatus = order.status;
    let newEventsCount = 0;
    let eventErrors = 0;

    for (const event of trackingEvents) {
      const { data: wasInserted, error } = await supabase.rpc('add_tracking_event', {
        p_order_id: orderId,
        p_event_type: event.publicEventType,
        p_state_type: event.publicStateType,
        p_state_text: event.publicStateText,
        p_location: event.location || null,
        p_description: event.publicEventText || event.publicStateText,
        p_event_timestamp: event.eventDate,
      });

      if (error) {
        eventErrors++;
        console.error('[Tracking] Error inserting event:', {
          orderId,
          stateType: event.publicStateType,
          eventDate: event.eventDate,
          error: error.message,
          code: error.code,
        });
      } else if (wasInserted) {
        newEventsCount++;
      }
    }

    // Auto-transition: if PARCEL_DELIVERED detected and order is shipped → delivered
    const hasDeliveryEvent = trackingEvents.some(
      (e) => e.publicStateType === 'PARCEL_DELIVERED'
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
        .select('*, order_items(listing_id, listings(game_name)), listings(game_name), buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, email), seller_profile:user_profiles!orders_seller_id_fkey(full_name, email)')
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

        const buyerProfile = delivered.buyer_profile as { full_name?: string; email?: string } | null;
        const sellerProfile = delivered.seller_profile as { full_name?: string; email?: string } | null;
        const gameName = getOrderGameSummary(delivered.order_items as OrderItemLike[], delivered.listings as LegacyListingsLike);

        // Notify buyer — this is their signal that the 2-day dispute window has started
        if (buyerProfile?.email) {
          void sendOrderDeliveredToBuyer({
            buyerName: buyerProfile.full_name ?? 'Buyer',
            buyerEmail: buyerProfile.email,
            orderNumber: delivered.order_number,
            orderId,
            gameName,
          }).catch((err) => console.error('[Email] Failed to send auto-delivery buyer email:', err));
        }

        // Notify seller — parcel picked up, dispute window started
        if (sellerProfile?.email) {
          void sendOrderDeliveredToSeller({
            sellerName: sellerProfile.full_name ?? 'Seller',
            sellerEmail: sellerProfile.email,
            orderNumber: delivered.order_number,
            orderId,
            gameName,
            buyerName: buyerProfile?.full_name ?? 'Buyer',
          }).catch((err) => console.error('[Email] Failed to send auto-delivery seller email:', err));
        }

        void notify(delivered.buyer_id, 'order.delivered', {
          gameName,
          orderNumber: delivered.order_number,
          orderId,
        });

        void notify(delivered.seller_id, 'order.delivered_seller', {
          gameName,
          orderNumber: delivered.order_number,
          orderId,
          buyerName: buyerProfile?.full_name,
        });

        console.log(`[Tracking] Auto-delivered order ${orderId} via PARCEL_DELIVERED`);
      }
    }

    // Auto-transition: if PARCEL_RECEIVED detected and order is accepted → shipped
    // Guard: only act on recent events to prevent stale transitions after deploy
    const receivedEvent = trackingEvents.find(
      (e) =>
        e.publicStateType === 'PARCEL_RECEIVED' &&
        Date.now() - new Date(e.eventDate).getTime() < AUTO_SHIP_MAX_AGE_MS
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
        .select('*, order_items(listing_id, listings(game_name)), listings(game_name), buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, email), seller_profile:user_profiles!orders_seller_id_fkey(full_name, email)')
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
        const sellerProfile = shipped.seller_profile as { full_name?: string; email?: string } | null;
        const gameName = getOrderGameSummary(shipped.order_items as OrderItemLike[], shipped.listings as LegacyListingsLike);
        const terminalName = receivedEvent.location || undefined;

        if (buyerProfile?.email) {
          void sendOrderShippedToBuyer({
            buyerName: buyerProfile.full_name ?? 'Buyer',
            buyerEmail: buyerProfile.email,
            orderNumber: shipped.order_number,
            orderId,
            gameName,
            barcode: shipped.barcode ?? undefined,
            trackingUrl: shipped.tracking_url ?? undefined,
            terminalName,
          }).catch((err) => console.error('[Email] Failed to send auto-ship buyer email:', err));
        }

        if (sellerProfile?.email) {
          void sendOrderShippedToSeller({
            sellerName: sellerProfile.full_name ?? 'Seller',
            sellerEmail: sellerProfile.email,
            orderNumber: shipped.order_number,
            orderId,
            gameName,
            buyerName: buyerProfile?.full_name ?? 'Buyer',
            terminalName: shipped.terminal_name ?? undefined,
            terminalCountry: shipped.terminal_country ?? undefined,
            isCrossBorder: shipped.seller_country !== shipped.terminal_country,
          }).catch((err) => console.error('[Email] Failed to send auto-ship seller email:', err));
        }

        void notify(shipped.buyer_id, 'shipping.scanned', {
          gameName,
          orderNumber: shipped.order_number,
          orderId,
          terminalName,
        });

        void notify(shipped.seller_id, 'shipping.scanned_seller', {
          orderId,
          orderNumber: shipped.order_number,
          gameName,
        });

        console.log(`[Tracking] Auto-shipped order ${orderId} via PARCEL_RECEIVED at ${terminalName ?? 'unknown terminal'}`);
      }
    }

    // Auto-transition: if RETURNING detected and order is shipped → disputed (uncollected parcel)
    // Guard: only act on recent events (same rationale as PARCEL_RECEIVED age guard)
    const returningEvent = trackingEvents.find(
      (e) =>
        e.publicStateType === 'RETURNING' &&
        Date.now() - new Date(e.eventDate).getTime() < AUTO_SHIP_MAX_AGE_MS
    );
    const currentStatus = statusChanged ? newStatus : oldStatus;

    if (returningEvent && currentStatus === 'shipped') {
      // Idempotency: skip if dispute already exists
      const { data: existingDispute } = await supabase
        .from('disputes')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (!existingDispute) {
        const { data: disputed, error: disputeError } = await supabase
          .from('orders')
          .update({
            status: 'disputed',
            disputed_at: new Date().toISOString(),
          })
          .eq('id', orderId)
          .eq('status', 'shipped') // Optimistic lock
          .select('*, order_items(listing_id, listings(game_name)), listings(game_name), buyer_profile:user_profiles!orders_buyer_id_fkey(full_name, email), seller_profile:user_profiles!orders_seller_id_fkey(full_name, email)')
          .single();

        if (disputed && !disputeError) {
          statusChanged = true;
          newStatus = 'disputed';

          await supabase.from('disputes').insert({
            order_id: orderId,
            buyer_id: disputed.buyer_id,
            seller_id: disputed.seller_id,
            reason: 'Auto-escalated: parcel not collected, returning to sender',
            photos: [],
            escalated_at: new Date().toISOString(),
          });

          void logAuditEvent({
            actorType: 'cron',
            action: 'order.parcel_returning',
            resourceType: 'order',
            resourceId: orderId,
            metadata: { orderNumber: disputed.order_number, trigger: 'tracking_returning' },
          });

          const buyerProfile = disputed.buyer_profile as { full_name?: string; email?: string } | null;
          const sellerProfile = disputed.seller_profile as { full_name?: string; email?: string } | null;
          const gameName = getOrderGameSummary(disputed.order_items as OrderItemLike[], disputed.listings as LegacyListingsLike);

          void sendDisputeEscalated({
            buyerName: buyerProfile?.full_name ?? 'Buyer',
            buyerEmail: buyerProfile?.email ?? '',
            sellerName: sellerProfile?.full_name ?? 'Seller',
            sellerEmail: sellerProfile?.email ?? '',
            orderNumber: disputed.order_number,
            orderId,
            gameName,
          }).catch((err) => console.error('[Tracking] Failed to send returning-parcel escalation email:', err));

          void notifyMany([
            { userId: disputed.buyer_id, type: 'shipping.returning', context: { gameName, orderNumber: disputed.order_number, orderId } },
            { userId: disputed.seller_id, type: 'shipping.returning', context: { gameName, orderNumber: disputed.order_number, orderId } },
          ]);

          console.log(`[Tracking] Auto-disputed order ${orderId} — parcel returning (uncollected)`);
        }
      }
    }

    return {
      success: true,
      newEventsCount,
      eventErrors,
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
      eventErrors: 0,
      statusChanged: false,
    };
  }
}

/**
 * Sync tracking for all active T2T orders via bulk fetch.
 * Single POST to Unisend for all barcodes, then per-order processing.
 * Called by cron job.
 */
export async function syncAllActiveOrders(): Promise<{
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  newEventsTotal: number;
  eventErrorsTotal: number;
  dateFrom: string | null;
  statusChanges: Array<{ orderId: string; orderNumber: string; oldStatus: string; newStatus: string }>;
}> {
  const supabase = createServiceClient();

  // 1. Load active orders
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, order_number, barcode, status')
    .eq('shipping_method', 'unisend_t2t')
    .not('barcode', 'is', null)
    .in('status', ['accepted', 'shipped']);

  if (ordersError || !orders || orders.length === 0) {
    if (ordersError) console.error('[Tracking] Error fetching orders:', ordersError);
    return { totalProcessed: 0, successCount: 0, errorCount: 0,
             newEventsTotal: 0, eventErrorsTotal: 0, dateFrom: null, statusChanges: [] };
  }

  // 2. Load last sync timestamp
  const { data: syncState } = await supabase
    .from('tracking_sync_state')
    .select('last_synced_at')
    .eq('id', 1)
    .single();
  const dateFrom = syncState?.last_synced_at ?? null;

  // 3. Capture sync start BEFORE API call (high-water mark pattern)
  const thisSyncStartedAt = new Date().toISOString();

  // 4. Bulk fetch all events
  const unisend = getUnisendClient();
  const barcodes = orders.map(o => o.barcode!);
  let allEvents: TrackingEvent[];
  try {
    allEvents = await unisend.getTrackingEventsBulk(barcodes, dateFrom ?? undefined);
  } catch (err) {
    console.error('[Tracking] Bulk fetch failed:', err);
    // Do NOT advance last_synced_at — next tick retries from same dateFrom
    return { totalProcessed: orders.length, successCount: 0, errorCount: orders.length,
             newEventsTotal: 0, eventErrorsTotal: 0, dateFrom, statusChanges: [] };
  }

  // 5. Group events by barcode
  const orderBarcodes = new Set(barcodes);
  const eventsByBarcode = new Map<string, TrackingEvent[]>();
  for (const event of allEvents) {
    if (!orderBarcodes.has(event.mailBarcode)) continue;
    const list = eventsByBarcode.get(event.mailBarcode) ?? [];
    list.push(event);
    eventsByBarcode.set(event.mailBarcode, list);
  }

  const unknownCount = allEvents.filter(e => !orderBarcodes.has(e.mailBarcode)).length;
  if (unknownCount > 0) {
    console.warn(`[Tracking] Bulk fetch returned ${unknownCount} events for unknown barcodes`);
  }

  // 6. Process each order (DB-only, no more API calls or delays)
  let successCount = 0;
  let errorCount = 0;
  let newEventsTotal = 0;
  let eventErrorsTotal = 0;
  const statusChanges: Array<{ orderId: string; orderNumber: string; oldStatus: string; newStatus: string }> = [];

  for (const order of orders) {
    const orderEvents = eventsByBarcode.get(order.barcode!) ?? [];
    const result = await processOrderEvents(
      { id: order.id, order_number: order.order_number, barcode: order.barcode!, status: order.status },
      orderEvents
    );
    newEventsTotal += result.newEventsCount;
    eventErrorsTotal += result.eventErrors;

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
  }

  // 7. Advance last_synced_at with safety margin.
  // Subtracting 1 hour means next tick re-fetches recent events, letting the
  // idempotent RPC retry any that failed to insert on this tick.
  const advanceTo = new Date(Date.parse(thisSyncStartedAt) - SYNC_SAFETY_MARGIN_MS).toISOString();
  await supabase
    .from('tracking_sync_state')
    .update({ last_synced_at: advanceTo })
    .eq('id', 1);

  return {
    totalProcessed: orders.length,
    successCount,
    errorCount,
    newEventsTotal,
    eventErrorsTotal,
    dateFrom,
    statusChanges,
  };
}
