-- Add shipping_error column for storing Unisend parcel creation failures.
-- Used when the seller accepts an order but Unisend API is unavailable.
-- The seller can retry shipping later via the retry-shipping endpoint.
ALTER TABLE orders ADD COLUMN shipping_error TEXT;
