-- Redesign wanted listings: simplify to saved search + notification matching.
-- Remove the private offer system entirely. Add edition preference fields.
-- Drop condition/budget fields (buyer just wants the game).

BEGIN;

-- ============================================================================
-- 1. DROP wanted_offer_id FK FROM LISTINGS
-- ============================================================================

DROP INDEX IF EXISTS idx_listings_wanted_offer;
ALTER TABLE listings DROP COLUMN IF EXISTS wanted_offer_id;

-- ============================================================================
-- 2. DROP WANTED OFFERS TABLE (and its triggers, indexes, RLS policies)
-- ============================================================================

DROP TABLE IF EXISTS wanted_offers CASCADE;

-- ============================================================================
-- 3. UPDATE wanted_listings STATUS CHECK (remove 'filled')
-- ============================================================================

-- Move any 'filled' rows to 'cancelled' before tightening the constraint
UPDATE wanted_listings SET status = 'cancelled' WHERE status = 'filled';

-- Replace the CHECK constraint on status
ALTER TABLE wanted_listings DROP CONSTRAINT IF EXISTS wanted_listings_status_check;
ALTER TABLE wanted_listings ADD CONSTRAINT wanted_listings_status_check
  CHECK (status IN ('active', 'cancelled'));

-- ============================================================================
-- 4. DROP CONDITION AND BUDGET COLUMNS
-- ============================================================================

ALTER TABLE wanted_listings
  DROP COLUMN IF EXISTS min_condition,
  DROP COLUMN IF EXISTS max_price_cents;

-- ============================================================================
-- 5. ADD EDITION PREFERENCE FIELDS
-- ============================================================================

ALTER TABLE wanted_listings
  ADD COLUMN version_source TEXT CHECK (version_source IS NULL OR version_source IN ('bgg', 'manual')),
  ADD COLUMN bgg_version_id INTEGER,
  ADD COLUMN version_name TEXT,
  ADD COLUMN publisher TEXT,
  ADD COLUMN language TEXT,
  ADD COLUMN edition_year INTEGER;

-- ============================================================================
-- 6. UPDATE get_pending_actions RPC (remove wanted_offers reference)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_actions(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'seller_orders_pending',
      (SELECT COUNT(*)::integer FROM orders
       WHERE seller_id = p_user_id AND status = 'pending_seller'),
    'seller_orders_to_ship',
      (SELECT COUNT(*)::integer FROM orders
       WHERE seller_id = p_user_id AND status = 'accepted'),
    'seller_disputes',
      (SELECT COUNT(*)::integer FROM orders
       WHERE seller_id = p_user_id AND status = 'disputed'),
    'seller_offers_pending',
      (SELECT COUNT(*)::integer FROM offers
       WHERE seller_id = p_user_id AND status = 'pending'),
    'buyer_disputes',
      (SELECT COUNT(*)::integer FROM orders
       WHERE buyer_id = p_user_id AND status = 'disputed'),
    'buyer_delivery_confirm',
      (SELECT COUNT(*)::integer FROM orders
       WHERE buyer_id = p_user_id AND status = 'delivered'),
    'buyer_auctions_won',
      (SELECT COUNT(*)::integer FROM listings
       WHERE highest_bidder_id = p_user_id AND status = 'auction_ended'
         AND listing_type = 'auction'),
    'is_seller',
      (
        (SELECT COUNT(*)::integer FROM orders
         WHERE seller_id = p_user_id AND status = 'completed') > 0
        OR
        (SELECT COUNT(*)::integer FROM listings
         WHERE seller_id = p_user_id AND status = 'active') > 0
      )
  );
$$;

COMMIT;
