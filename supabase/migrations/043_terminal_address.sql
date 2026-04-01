-- Store full terminal address for order detail display
-- Captured at checkout time to handle terminal renames/closures
ALTER TABLE orders ADD COLUMN terminal_address TEXT;
ALTER TABLE orders ADD COLUMN terminal_city TEXT;
ALTER TABLE orders ADD COLUMN terminal_postal_code TEXT;

-- Also store on checkout sessions and cart groups (terminal data passes through → order)
ALTER TABLE checkout_sessions ADD COLUMN terminal_address TEXT;
ALTER TABLE checkout_sessions ADD COLUMN terminal_city TEXT;
ALTER TABLE checkout_sessions ADD COLUMN terminal_postal_code TEXT;

ALTER TABLE cart_checkout_groups ADD COLUMN terminal_address TEXT;
ALTER TABLE cart_checkout_groups ADD COLUMN terminal_city TEXT;
ALTER TABLE cart_checkout_groups ADD COLUMN terminal_postal_code TEXT;
