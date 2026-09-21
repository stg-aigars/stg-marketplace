-- Local pickup discoverability: a seller can note they're open to arranging
-- in-person pickup instead of shipping (buyers already coordinate this via
-- messaging today — this just makes the option visible on the listing).
-- Also adds an optional removal reason, set only by the seller-initiated
-- cancelListing() action, for the team's own visibility into how listings
-- actually leave the marketplace (sold elsewhere, sold in person, etc.).
-- Not load-bearing for any other flow — orders/checkout/wallet/dispute are
-- untouched by this migration.

ALTER TABLE listings
  ADD COLUMN local_pickup_available BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN local_pickup_note TEXT,
  ADD COLUMN removal_reason TEXT;
