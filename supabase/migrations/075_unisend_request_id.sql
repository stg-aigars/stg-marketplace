-- Store the requestId from Unisend initiateShipping response.
-- Not currently used, but enables future status verification via
-- GET /api/v2/shipping/status/{requestId}.
ALTER TABLE orders ADD COLUMN unisend_request_id TEXT;
