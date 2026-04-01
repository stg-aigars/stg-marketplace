import { createServiceClient } from '@/lib/supabase';
import type { TrackingEvent } from '@/components/orders/TrackingTimeline';

/** Fetch tracking events for an order, sorted chronologically */
export async function getTrackingEvents(orderId: string): Promise<TrackingEvent[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('tracking_events')
    .select('state_type, state_text, location, event_timestamp')
    .eq('order_id', orderId)
    .order('event_timestamp', { ascending: true });

  if (error) {
    console.error('[Tracking] Error fetching tracking events:', error);
    return [];
  }

  return data ?? [];
}
