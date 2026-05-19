-- 114_drop_redundant_indexes.sql
--
-- Drop two indexes that are either dead-code or strictly redundant.
-- Both flagged as `unused_index` by the Supabase performance advisor
-- (idx_scan = 0 since stats reset on 2026-05-10).
--
-- Most of the other advisor-flagged "unused" indexes are KEPT on purpose:
--   - they support feature paths that haven't ramped up yet (disputes,
--     accounting, login_activity, trader detection, etc.); or
--   - the planner picks seq-scan over them today only because the table
--     is tiny — they'll start winning as data grows.
--
-- The two below are different: one has zero SQL callers and one is a
-- strict subset of an existing composite. Both are safe to remove.

-- 1) public.listings.idx_listings_reserved_by
--    `reserved_by` is read off rows that were already fetched by PK
--    (cart-create, cart-wallet-pay, listing detail) but NEVER appears
--    in a `.eq('reserved_by', ...)` filter or SQL WHERE clause anywhere
--    in the codebase. The cart-rollback flow finds reserved rows via
--    `reserved_at` + `status` predicates, not via this column.
drop index if exists public.idx_listings_reserved_by;

-- 2) public.wallet_transactions.idx_wallet_transactions_withdrawal
--    Strictly redundant with the UNIQUE composite
--    `idx_wallet_txn_withdrawal_type (withdrawal_id, type)` — any lookup
--    on `withdrawal_id` alone can use that composite as a prefix. The
--    unique composite stays in place and continues to enforce the
--    "no double credit per withdrawal_id+type" invariant.
drop index if exists public.idx_wallet_transactions_withdrawal;
