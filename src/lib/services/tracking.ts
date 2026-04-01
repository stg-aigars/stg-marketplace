import { createServiceClient } from '@/lib/supabase';

/** DB row shape for tracking events displayed in the order timeline */
export interface TrackingEventRow {
  state_type: string;
  state_text: string | null;
  location: string | null;
  event_timestamp: string;
}

/** Fetch tracking events for an order, sorted chronologically */
export async function getTrackingEvents(orderId: string): Promise<TrackingEventRow[]> {
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
