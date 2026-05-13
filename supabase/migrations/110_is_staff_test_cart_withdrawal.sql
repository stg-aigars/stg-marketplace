-- 110_is_staff_test_cart_withdrawal.sql
--
-- PR C commit 14 followup — extend the `is_staff_test` gating column to the
-- two entity types that drive the stage-2 staff-test cutover variants but
-- currently can't be marked as test rows.
--
-- Migration 103 added `orders.is_staff_test` with this documented contract:
--   "parent RPCs (cart_complete_payment_with_gl, complete_order_with_gl, etc.)
--    check this during the staff-only burn-in stage of the
--    ACCOUNTING_ENGINE_ENABLED rollout."
--
-- However, 103 only added the column to `orders`. The cutover runbook's
-- stage-2 verification (docs/operations/lifecycle-cutover-runbook.md §3)
-- exercises 7 variants — 5 of which fire C.1/C.2 cart-payment wraps before
-- orders even exist, and 1 of which fires the C.4 withdrawal wrap on a
-- `withdrawal_requests` row that has no orders linkage. Without an is_staff_test
-- column on those tables, stage 2 cannot mark them as test entities; the
-- wrap-layer gate has nothing to read.
--
-- This migration adds:
--   - cart_checkout_groups.is_staff_test (drives cart C.1/C.2 + paired C.9)
--   - withdrawal_requests.is_staff_test (drives C.4)
--
-- Both default false. Application contract mirrors `orders.is_staff_test`:
-- the wrap reads the column before emit and either takes the engine path
-- (column=true) or the legacy path (column=false). After stage 3 cutover,
-- the column stays in the schema (audit / test reproducibility) but wraps
-- stop reading the inner check; engine path runs unconditionally.

-- ============================================================================
-- 1. cart_checkout_groups.is_staff_test
-- ============================================================================

alter table public.cart_checkout_groups
  add column is_staff_test boolean not null default false;

comment on column public.cart_checkout_groups.is_staff_test is
  'Application contract: cart fulfillment wrap (lifecycle-wraps.ts:cartFulfillmentWithGL) checks this during the staff-only burn-in stage of the ACCOUNTING_ENGINE_ENABLED rollout. Real customer carts skip GL emission until the global stage; staff test carts emit C.1/C.2 (+ paired C.9 when applicable) through the full pipeline with posting_context.is_staff_test=true. Once the flag is global the column becomes vestigial (kept for audit/test reproducibility).';

-- ============================================================================
-- 2. withdrawal_requests.is_staff_test
-- ============================================================================

alter table public.withdrawal_requests
  add column is_staff_test boolean not null default false;

comment on column public.withdrawal_requests.is_staff_test is
  'Application contract: withdrawal completion wrap (lifecycle-wraps.ts:withdrawalCompletionWithGL) checks this during the staff-only burn-in stage of the ACCOUNTING_ENGINE_ENABLED rollout. Real seller withdrawals skip GL emission until the global stage; staff test withdrawals emit C.4 (Dr 5351 / Cr 2610) with posting_context.is_staff_test=true. Once the flag is global the column becomes vestigial (kept for audit/test reproducibility).';
