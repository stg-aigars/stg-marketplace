-- Fix: schema-qualify table references in all functions that had
-- search_path = '' set by migration 059. Without public. prefix,
-- PostgreSQL cannot resolve table names when search_path is empty.

-- 1. expire_stale_reservations — references listings, orders
CREATE OR REPLACE FUNCTION public.expire_stale_reservations(cutoff TIMESTAMPTZ)
RETURNS SETOF UUID AS $$
  UPDATE public.listings SET status = 'active', reserved_at = NULL, reserved_by = NULL
  WHERE status = 'reserved'
    AND reserved_at IS NOT NULL
    AND reserved_at < cutoff
    AND NOT EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.listing_id = listings.id
      AND orders.status NOT IN ('cancelled', 'refunded')
    )
  RETURNING id;
$$ LANGUAGE sql SECURITY DEFINER
SET search_path = '';

-- 2. add_tracking_event — references tracking_events
CREATE OR REPLACE FUNCTION public.add_tracking_event(
  p_order_id UUID,
  p_event_type TEXT,
  p_state_type TEXT,
  p_state_text TEXT,
  p_location TEXT,
  p_description TEXT,
  p_event_timestamp TIMESTAMPTZ
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.tracking_events (order_id, event_type, state_type, state_text, location, description, event_timestamp)
  VALUES (p_order_id, p_event_type, p_state_type, p_state_text, p_location, p_description, p_event_timestamp)
  ON CONFLICT (order_id, state_type, event_timestamp) DO NOTHING;
  RETURN FOUND;
END;
$$;

-- 3. upsert_dac7_seller_stats — references dac7_seller_annual_stats
CREATE OR REPLACE FUNCTION public.upsert_dac7_seller_stats(
  p_seller_id uuid,
  p_calendar_year smallint,
  p_consideration_cents integer
) RETURNS void AS $$
BEGIN
  INSERT INTO public.dac7_seller_annual_stats (seller_id, calendar_year, completed_transaction_count, total_consideration_cents, updated_at)
  VALUES (p_seller_id, p_calendar_year, 1, p_consideration_cents, now())
  ON CONFLICT (seller_id, calendar_year)
  DO UPDATE SET
    completed_transaction_count = dac7_seller_annual_stats.completed_transaction_count + 1,
    total_consideration_cents = dac7_seller_annual_stats.total_consideration_cents + p_consideration_cents,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- 4. reserve_listings_atomic — references listings
CREATE OR REPLACE FUNCTION public.reserve_listings_atomic(
  p_listing_ids UUID[],
  p_buyer_id UUID
) RETURNS UUID[] AS $$
DECLARE
  v_unavailable UUID[];
BEGIN
  PERFORM id FROM public.listings
    WHERE id = ANY(p_listing_ids)
    ORDER BY id
    FOR UPDATE;

  SELECT ARRAY_AGG(id) INTO v_unavailable
  FROM (
    SELECT UNNEST(p_listing_ids) AS id
    EXCEPT
    SELECT id FROM public.listings
      WHERE id = ANY(p_listing_ids)
        AND status = 'active'
  ) AS unavailable;

  IF v_unavailable IS NOT NULL AND array_length(v_unavailable, 1) > 0 THEN
    RETURN v_unavailable;
  END IF;

  UPDATE public.listings
  SET status = 'reserved',
      reserved_by = p_buyer_id,
      reserved_at = NOW()
  WHERE id = ANY(p_listing_ids)
    AND status = 'active';

  RETURN ARRAY[]::UUID[];
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- 5. unreserve_listings — references listings
CREATE OR REPLACE FUNCTION public.unreserve_listings(
  p_listing_ids UUID[],
  p_buyer_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.listings
  SET status = 'active',
      reserved_by = NULL,
      reserved_at = NULL
  WHERE id = ANY(p_listing_ids)
    AND status = 'reserved'
    AND reserved_by = p_buyer_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql
SET search_path = '';
