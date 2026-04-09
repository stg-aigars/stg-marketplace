-- Supabase advisor fixes: security + performance
-- Applied to production via execute_sql on 2026-04-09

-- Part 1: Fix SECURITY DEFINER view
CREATE OR REPLACE VIEW public_profiles
WITH (security_invoker = true) AS
  SELECT id, full_name, avatar_url, country, created_at
  FROM user_profiles;

-- Part 2: Set search_path on functions
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.update_updated_at() SET search_path = '';
ALTER FUNCTION public.sync_user_profile_email() SET search_path = '';
ALTER FUNCTION public.expire_stale_reservations(timestamptz) SET search_path = '';
ALTER FUNCTION public.add_tracking_event(uuid, text, text, text, text, text, timestamptz) SET search_path = '';
ALTER FUNCTION public.upsert_dac7_seller_stats(uuid, smallint, integer) SET search_path = '';
ALTER FUNCTION public.reserve_listings_atomic(uuid[], uuid) SET search_path = '';
ALTER FUNCTION public.unreserve_listings(uuid[], uuid) SET search_path = '';
ALTER FUNCTION public.search_games_by_name(text, boolean, integer) SET search_path = '';

-- Part 3+4: Recreate all RLS policies with (select auth.uid()) wrapper
-- Also merge overlapping SELECT policies on disputes, order_messages,
-- wallet_transactions, wallets, withdrawal_requests

-- bids
DROP POLICY IF EXISTS "bids_insert" ON bids;
CREATE POLICY "bids_insert" ON bids FOR INSERT WITH CHECK ((select auth.uid()) = bidder_id);

-- cart_checkout_groups
DROP POLICY IF EXISTS "Buyers can view own cart checkout groups" ON cart_checkout_groups;
CREATE POLICY "Buyers can view own cart checkout groups" ON cart_checkout_groups FOR SELECT USING ((select auth.uid()) = buyer_id);

-- checkout_sessions
DROP POLICY IF EXISTS "Buyers can view own sessions" ON checkout_sessions;
CREATE POLICY "Buyers can view own sessions" ON checkout_sessions FOR SELECT USING ((select auth.uid()) = buyer_id);

-- dac7_annual_reports
DROP POLICY IF EXISTS "Users can view own DAC7 reports" ON dac7_annual_reports;
CREATE POLICY "Users can view own DAC7 reports" ON dac7_annual_reports FOR SELECT USING ((select auth.uid()) = seller_id);

-- dac7_seller_annual_stats
DROP POLICY IF EXISTS "Users can view own DAC7 stats" ON dac7_seller_annual_stats;
CREATE POLICY "Users can view own DAC7 stats" ON dac7_seller_annual_stats FOR SELECT USING ((select auth.uid()) = seller_id);

-- disputes (MERGED: user + staff)
DROP POLICY IF EXISTS "Users can view own disputes" ON disputes;
DROP POLICY IF EXISTS "Staff can view all disputes" ON disputes;
CREATE POLICY "Users and staff can view disputes" ON disputes FOR SELECT USING (
  (select auth.uid()) = buyer_id
  OR (select auth.uid()) = seller_id
  OR EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND is_staff = true)
);

-- favorites
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
CREATE POLICY "Users can view own favorites" ON favorites FOR SELECT USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can add favorites" ON favorites;
CREATE POLICY "Users can add favorites" ON favorites FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can remove favorites" ON favorites;
CREATE POLICY "Users can remove favorites" ON favorites FOR DELETE USING ((select auth.uid()) = user_id);

-- listing_comments
DROP POLICY IF EXISTS "Authenticated users can post comments" ON listing_comments;
CREATE POLICY "Authenticated users can post comments" ON listing_comments FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- listing_expansions
DROP POLICY IF EXISTS "Sellers can add expansions to own listings" ON listing_expansions;
CREATE POLICY "Sellers can add expansions to own listings" ON listing_expansions FOR INSERT WITH CHECK (
  (select auth.uid()) = (SELECT listings.seller_id FROM listings WHERE listings.id = listing_expansions.listing_id)
);
DROP POLICY IF EXISTS "Sellers can update expansions on own listings" ON listing_expansions;
CREATE POLICY "Sellers can update expansions on own listings" ON listing_expansions FOR UPDATE USING (
  (select auth.uid()) = (SELECT listings.seller_id FROM listings WHERE listings.id = listing_expansions.listing_id)
);
DROP POLICY IF EXISTS "Sellers can delete expansions from own listings" ON listing_expansions;
CREATE POLICY "Sellers can delete expansions from own listings" ON listing_expansions FOR DELETE USING (
  (select auth.uid()) = (SELECT listings.seller_id FROM listings WHERE listings.id = listing_expansions.listing_id)
);

-- listings
DROP POLICY IF EXISTS "Authenticated users can create listings" ON listings;
CREATE POLICY "Authenticated users can create listings" ON listings FOR INSERT WITH CHECK ((select auth.uid()) = seller_id);
DROP POLICY IF EXISTS "Anyone can view active, reserved, auction_ended, or own-order l" ON listings;
CREATE POLICY "Anyone can view active, reserved, auction_ended, or own-order l" ON listings FOR SELECT USING (
  status = ANY (ARRAY['active', 'reserved', 'auction_ended'])
  OR seller_id = (select auth.uid())
  OR EXISTS (
    SELECT 1 FROM order_items JOIN orders ON orders.id = order_items.order_id
    WHERE order_items.listing_id = listings.id
    AND (orders.buyer_id = (select auth.uid()) OR orders.seller_id = (select auth.uid()))
  )
);

-- notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING ((select auth.uid()) = user_id);

-- offers
DROP POLICY IF EXISTS "Users can view own offers" ON offers;
CREATE POLICY "Users can view own offers" ON offers FOR SELECT USING ((select auth.uid()) = buyer_id OR (select auth.uid()) = seller_id);
DROP POLICY IF EXISTS "Buyers can create offers" ON offers;
CREATE POLICY "Buyers can create offers" ON offers FOR INSERT WITH CHECK ((select auth.uid()) = buyer_id AND (select auth.uid()) <> seller_id);

-- order_items
DROP POLICY IF EXISTS "Order participants can view order items" ON order_items;
CREATE POLICY "Order participants can view order items" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.buyer_id = (select auth.uid()) OR orders.seller_id = (select auth.uid())))
);

-- order_messages (MERGED: participant + staff)
DROP POLICY IF EXISTS "Order participants can view messages" ON order_messages;
DROP POLICY IF EXISTS "Staff can view messages" ON order_messages;
CREATE POLICY "Participants and staff can view messages" ON order_messages FOR SELECT USING (
  deleted_at IS NULL AND (
    (select auth.uid()) IN (
      SELECT buyer_id FROM orders WHERE id = order_messages.order_id
      UNION ALL
      SELECT seller_id FROM orders WHERE id = order_messages.order_id
    )
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND is_staff = true)
  )
);
DROP POLICY IF EXISTS "Order participants can post messages" ON order_messages;
CREATE POLICY "Order participants can post messages" ON order_messages FOR INSERT WITH CHECK (
  (select auth.uid()) = user_id AND (select auth.uid()) IN (
    SELECT buyer_id FROM orders WHERE id = order_messages.order_id
    UNION ALL
    SELECT seller_id FROM orders WHERE id = order_messages.order_id
  )
);

-- orders
DROP POLICY IF EXISTS "Buyers and sellers can view their orders" ON orders;
CREATE POLICY "Buyers and sellers can view their orders" ON orders FOR SELECT USING ((select auth.uid()) = buyer_id OR (select auth.uid()) = seller_id);

-- reviews
DROP POLICY IF EXISTS "reviews_insert" ON reviews;
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (
  (select auth.uid()) = reviewer_id AND EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = reviews.order_id
    AND orders.buyer_id = (select auth.uid())
    AND orders.seller_id = reviews.seller_id
    AND orders.status = ANY (ARRAY['delivered', 'completed'])
    AND orders.delivered_at IS NOT NULL
    AND orders.delivered_at > (now() - '30 days'::interval)
  )
);

-- shelf_items
DROP POLICY IF EXISTS "Sellers can insert own shelf items" ON shelf_items;
CREATE POLICY "Sellers can insert own shelf items" ON shelf_items FOR INSERT WITH CHECK ((select auth.uid()) = seller_id);
DROP POLICY IF EXISTS "Sellers can update own shelf items" ON shelf_items;
CREATE POLICY "Sellers can update own shelf items" ON shelf_items FOR UPDATE USING ((select auth.uid()) = seller_id);
DROP POLICY IF EXISTS "Sellers can delete own shelf items" ON shelf_items;
CREATE POLICY "Sellers can delete own shelf items" ON shelf_items FOR DELETE USING ((select auth.uid()) = seller_id);

-- tracking_events
DROP POLICY IF EXISTS "Order participants can view tracking events" ON tracking_events;
CREATE POLICY "Order participants can view tracking events" ON tracking_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = tracking_events.order_id AND (orders.buyer_id = (select auth.uid()) OR orders.seller_id = (select auth.uid())))
);

-- user_profiles
DROP POLICY IF EXISTS "Authenticated users can view any profile" ON user_profiles;
CREATE POLICY "Authenticated users can view any profile" ON user_profiles FOR SELECT USING ((select auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING ((select auth.uid()) = id);

-- wallet_transactions (MERGED: user + staff)
DROP POLICY IF EXISTS "Users can view own transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "Staff can view all transactions" ON wallet_transactions;
CREATE POLICY "Users and staff can view transactions" ON wallet_transactions FOR SELECT USING (
  (select auth.uid()) = user_id
  OR EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND is_staff = true)
);

-- wallets (MERGED: user + staff)
DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
DROP POLICY IF EXISTS "Staff can view all wallets" ON wallets;
CREATE POLICY "Users and staff can view wallets" ON wallets FOR SELECT USING (
  (select auth.uid()) = user_id
  OR EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND is_staff = true)
);

-- wanted_listings
DROP POLICY IF EXISTS "wl_select" ON wanted_listings;
CREATE POLICY "wl_select" ON wanted_listings FOR SELECT USING (status = 'active' OR (select auth.uid()) = buyer_id);
DROP POLICY IF EXISTS "wl_insert" ON wanted_listings;
CREATE POLICY "wl_insert" ON wanted_listings FOR INSERT WITH CHECK ((select auth.uid()) = buyer_id);
DROP POLICY IF EXISTS "wl_update" ON wanted_listings;
CREATE POLICY "wl_update" ON wanted_listings FOR UPDATE USING ((select auth.uid()) = buyer_id);
DROP POLICY IF EXISTS "wl_delete" ON wanted_listings;
CREATE POLICY "wl_delete" ON wanted_listings FOR DELETE USING ((select auth.uid()) = buyer_id);

-- wanted_offers
DROP POLICY IF EXISTS "wo_select" ON wanted_offers;
CREATE POLICY "wo_select" ON wanted_offers FOR SELECT USING ((select auth.uid()) = buyer_id OR (select auth.uid()) = seller_id);
DROP POLICY IF EXISTS "wo_insert" ON wanted_offers;
CREATE POLICY "wo_insert" ON wanted_offers FOR INSERT WITH CHECK ((select auth.uid()) = seller_id AND (select auth.uid()) <> buyer_id);

-- withdrawal_requests (MERGED: user + staff)
DROP POLICY IF EXISTS "Users can view own withdrawals" ON withdrawal_requests;
DROP POLICY IF EXISTS "Staff can view all withdrawals" ON withdrawal_requests;
CREATE POLICY "Users and staff can view withdrawals" ON withdrawal_requests FOR SELECT USING (
  (select auth.uid()) = user_id
  OR EXISTS (SELECT 1 FROM user_profiles WHERE id = (select auth.uid()) AND is_staff = true)
);
DROP POLICY IF EXISTS "Users can create own withdrawals" ON withdrawal_requests;
CREATE POLICY "Users can create own withdrawals" ON withdrawal_requests FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- Part 5: Add missing FK indexes
CREATE INDEX IF NOT EXISTS idx_disputes_buyer_id ON disputes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_seller_id ON disputes(seller_id);
CREATE INDEX IF NOT EXISTS idx_disputes_escalated_by ON disputes(escalated_by);
CREATE INDEX IF NOT EXISTS idx_disputes_resolved_by ON disputes(resolved_by);
CREATE INDEX IF NOT EXISTS idx_listing_comments_deleted_by ON listing_comments(deleted_by);
CREATE INDEX IF NOT EXISTS idx_listing_expansions_bgg_game_id ON listing_expansions(bgg_game_id);
CREATE INDEX IF NOT EXISTS idx_listings_highest_bidder_id ON listings(highest_bidder_id);
CREATE INDEX IF NOT EXISTS idx_listings_reserved_by ON listings(reserved_by);
CREATE INDEX IF NOT EXISTS idx_order_messages_deleted_by ON order_messages(deleted_by);
CREATE INDEX IF NOT EXISTS idx_orders_listing_id ON orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_shelf_items_bgg_game_id ON shelf_items(bgg_game_id);
CREATE INDEX IF NOT EXISTS idx_shelf_items_listing_id ON shelf_items(listing_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_withdrawal ON wallet_transactions(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_reviewed_by ON withdrawal_requests(reviewed_by);

-- Part 6: Drop unused indexes
DROP INDEX IF EXISTS idx_checkout_sessions_payment_ref;
DROP INDEX IF EXISTS idx_checkout_sessions_listing;
DROP INDEX IF EXISTS idx_cart_checkout_groups_payment_ref;
DROP INDEX IF EXISTS idx_cart_checkout_groups_buyer;
DROP INDEX IF EXISTS idx_orders_buyer_status;
DROP INDEX IF EXISTS idx_orders_unisend_parcel_id;
DROP INDEX IF EXISTS idx_games_name_lower;
DROP INDEX IF EXISTS idx_audit_log_resource;
DROP INDEX IF EXISTS idx_audit_log_created;
DROP INDEX IF EXISTS idx_listing_comments_user;
DROP INDEX IF EXISTS idx_user_profiles_dac7_status;
DROP INDEX IF EXISTS idx_shelf_items_seller_bgg;
DROP INDEX IF EXISTS idx_wanted_offers_seller;
DROP INDEX IF EXISTS idx_wanted_listings_browse;
DROP INDEX IF EXISTS idx_bids_listing_amount;
DROP INDEX IF EXISTS idx_favorites_listing;
DROP INDEX IF EXISTS idx_listings_wanted_offer;
DROP INDEX IF EXISTS idx_order_messages_user;
