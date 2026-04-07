-- Track when the "ending soon" notification was sent for an auction
-- to prevent duplicate notifications on each cron tick.
ALTER TABLE listings
ADD COLUMN auction_ending_soon_notified_at TIMESTAMPTZ;
