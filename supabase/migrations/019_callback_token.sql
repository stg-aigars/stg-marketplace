-- Add callback_token to checkout_sessions for payment callback security.
-- Prevents probing of guessable order_reference values on the unauthenticated callback endpoint.
-- NULL for legacy sessions created before this migration.

ALTER TABLE checkout_sessions ADD COLUMN callback_token TEXT;
