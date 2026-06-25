# Cart Fulfillment Mid-Loop Rollback Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop a cart-checkout failure from ever leaving an order alive after its payment has been refunded, and make every refund/rollback in this path idempotent and visible in Sentry.

**Architecture:** `fulfillCartPayment` (`src/lib/services/payment-fulfillment.ts`) currently trusts an in-memory array (`createdOrders`) to know which orders need rolling back when a mid-loop failure occurs, and rolls them back with unchecked, non-idempotent ad-hoc `UPDATE`s, in the wrong order (card refund before cancellation). The fix replaces the in-memory tracking with a direct re-query of `orders` by `cart_group_id` (so a row that's invisible to `createdOrders` is still found), and replaces the ad-hoc rollback with three small idempotent helpers run in a strict cancel-then-refund-then-stamp sequence, mirroring the already-proven `autoCancelOrders` pattern in `order-deadlines.ts`. `createOrder()` (`src/lib/services/orders.ts`) gets defensive error-checking on its own internal cleanup so a DB-level failure there is observable immediately instead of silently swallowed.

**Tech stack:** TypeScript, Supabase (Postgres + RPC), Sentry (`@sentry/nextjs`), Vitest.

**Revision note (post-review, round 1):** the first draft refunded the card *before* cancelling sibling orders in the catch block — that reproduces the incident's exact shape if the process dies between the two steps. Section "2. Correct compensation" is rewritten cancel-first. Also folded in: a callback-route idempotency gap (`cart_checkout_groups.status = 'expired'` wasn't treated as already-handled) and a wallet-RPC misclassification (the unavailable-items refund used `wallet_credit`, documented as seller-earnings, instead of `wallet_refund`).

**Revision note (post-review, round 2):** round 1's own reconciliation canary was mis-specified — it summed only orders that persisted a row, but the order that *triggers* a mid-loop failure typically self-deletes inside `createOrder()` before persisting, so the canary compared the wrong two numbers and would have fired on every normal rollback (caught by walking a 2-seller example through by hand). Replaced with a direct post-condition: after the rollback completes, re-query for any order tied to the group that isn't `cancelled` — that's the literal incident condition, and it doesn't fire on the routine case. Separately, the Phase 1 pessimistic refund-status stamp was wired to also fire `Sentry.captureException` on every call — since Phase 1 always passes `cardRefundOk=false` (the card hasn't been refunded yet), that capture fired on every rollback, successful or not. Split the stamp helper's DB write (needed in Phase 1, for crash-visibility) from its Sentry capture (now Phase-3-only, via a `captureIfIncomplete` flag). Also: `claimAndCancelOrder`'s own two new Postgrest calls (`unreserve_listings`, `order_items.active=false`) weren't error-checked — the exact pattern seam #1 exists to kill, reintroduced in the new helper. Both fixed below.

---

## Incident recap (given, not re-derived)

Order STG-20260606-UJRJ, 06.06.2026: order row INSERT committed at 19:46:12.08; ~1.3s later a full €34.10 refund fired via `attemptAutoRefund` with reason `"cart order creation failed mid-loop"`. The order was never cancelled — it went through accept → ship → deliver → complete, and the seller was credited €28.80. The order still reads `everypay_payment_state = 'settled'`, `refund_status = null`. No Sentry exception, no log beyond a `console.error`. Single occurrence to date.

## Files read

- `src/lib/services/payment-fulfillment.ts` (full file — `fulfillCartPayment`, `attemptAutoRefund`)
- `src/lib/services/orders.ts` (full file — `createOrder`, `lookupSellerIbanCountry`)
- `src/lib/services/order-refund.ts` (full file — `refundOrder`, `markRefundFailed`, `RefundInitiationError`)
- `src/lib/services/order-deadlines.ts` (`autoCancelOrders` — the canonical cancel+refund composition pattern)
- `src/lib/services/dispute.ts` (Sentry.captureException call-site conventions; `restoreListingsAfterRefund`)
- `src/app/api/payments/callback/route.ts` (full file — the EveryPay redirect callback, the only other caller besides the cron)
- `src/app/api/cron/reconcile-payments/route.ts` (full file — current scope: orphaned cart groups + wallet-debit retry; digest-alert email pattern)
- `src/lib/orders/types.ts` (full file — `OrderStatus`, `CancellationReason`, `OrderRow`, `CreateOrderParams`)
- `src/lib/services/everypay/client.ts` (`refundPayment` — confirmed no app-level idempotency/dedup by amount; it's a thin pass-through to EveryPay)
- `supabase/migrations/035_order_items.sql` — `order_items.order_id` is `ON DELETE RESTRICT`; `idx_order_items_active_listing` is a **partial unique index on `listing_id WHERE active = true`**
- `supabase/migrations/069_critical_db_constraints.sql` — confirms `cancellation_reason` CHECK includes `'system'`; confirms `refund_amount_cents >= 0` check
- `supabase/migrations/025_cart_checkout.sql` — `unreserve_listings(p_listing_ids, p_buyer_id)` RPC (status='reserved' AND reserved_by=buyer_id guard, returns count)
- Existing tests: `src/lib/services/payment-fulfillment.test.ts`, `src/lib/services/orders.test.ts`, `src/lib/services/order-refund.test.ts`, `src/test/scenarios/payment-edges.test.ts`, `src/test/integration/payment-fulfillment.test.ts` — none currently cover the mid-loop multi-seller rollback path

**Re-read/added during review:**
- `src/lib/services/wallet.ts` (full file — `creditWallet`/`refundToWallet`/`debitWallet`; confirmed `refundToWallet`'s own doc-comment: "Uses type='refund' to avoid idempotency collision with seller type='credit' on the same order_id")
- `supabase/migrations/070_atomic_wallet_rpcs.sql` (full file — `wallet_credit` doc-commented "seller earnings on order completion"; `wallet_refund` doc-commented "buyer refund on dispute/cancellation")
- `supabase/migrations/022_disputes.sql` (the `wallet_transactions_type_check` widening: "Add 'refund' type for buyer refund credits (separate from seller 'credit' ...)")
- `supabase/migrations/018_wallet_system.sql` (original `wallet_transactions.type` CHECK — confirms the 4 valid values: credit/debit/withdrawal/refund)
- `src/app/[locale]/account/wallet/TransactionList.tsx` (full file — `TYPE_LABELS`/`TYPE_BADGE_VARIANT` maps and the +/- sign logic; confirmed no `'refund'` entry exists)
- Re-verified `src/app/api/payments/callback/route.ts:89-104` and `src/app/api/cron/reconcile-payments/route.ts:47-55` line-by-line for the existing-orders/status-filter idempotency predicates

CLAUDE.md sections re-read: Payment Model, Order Status State Machine, Cancellation Reasons, Cron Routes, Server Action Error Handling, Audit Events register.

---

## Root-cause analysis

### Failure seam #1 (primary, best-evidenced) — `createOrder()`'s own rollback can silently fail, leaking a row that's invisible to its caller

`createOrder()` (`src/lib/services/orders.ts:74-202`) does three sequential writes per order: INSERT `orders`, INSERT `order_items`, UPDATE `listings` to `reserved`. If the listings UPDATE doesn't cover every requested listing (line 177, `updatedListings.length !== listingIds.length` — a normal concurrent-availability race, not a system failure), it tries to roll itself back:

```ts
await serviceClient.from('order_items').delete().eq('order_id', order.id);
await serviceClient.from('orders').delete().eq('id', order.id);
```

**Neither delete's `{ error }` is checked.** `order_items.order_id` is `ON DELETE RESTRICT` (migration 035). If the `order_items` delete doesn't fully succeed for any reason (lock contention, a transient Postgres error — Postgrest returns this as `{ error }`, it does not throw), the very next line's `orders` delete is silently blocked by that same RESTRICT constraint — also returned as an unchecked `{ error }`. The function then throws its normal, expected `'One or more listings are no longer available'` — exactly as if cleanup had succeeded. Nothing here is exceptional from the caller's point of view: `fulfillCartPayment`'s loop sees an ordinary rejected promise.

Because `createOrder()` never returns in this case, the failing order is never pushed into `fulfillCartPayment`'s `createdOrders` array — so the **outer rollback loop doesn't know it exists**. The order row (full financial snapshot, `status: 'pending_seller'`) is left exactly as INSERTed. This reproduces every observed symptom: row persists, no cancellation, no refund fields touched, no exception anywhere (Postgrest errors aren't exceptions, so there's nothing for Sentry to catch even if it were wired up on this path).

### Failure seam #2 (secondary, definitely present, broader) — the mid-loop catch's per-order rollback is ad-hoc, unchecked, non-idempotent, and incomplete

`fulfillCartPayment`'s catch (`payment-fulfillment.ts:263-291`) fires whenever **any** order in the per-seller loop throws — including the *normal* "this seller's order failed legitimately" case (e.g. seller #2's listing got grabbed by another buyer while seller #1's order had already been created and pushed into `createdOrders`). For every order already in `createdOrders`, it does:

```ts
await refundToWallet(group.buyer_id, created.walletDebitCents, created.id, '...');
await serviceClient.from('orders').update({ status: 'cancelled', cancelled_at, cancellation_reason: 'system' }).eq('id', created.id);
```

Compared to the one other place in the codebase that does this exact "cancel order + reverse its money" composition — `autoCancelOrders` in `order-deadlines.ts:217-296` — this is missing every safety property that pattern has:

| Gap | `autoCancelOrders` (correct) | `fulfillCartPayment` catch (today) |
|---|---|---|
| Optimistic lock on the cancel UPDATE | `.eq('status', status)` + `.select('id').single()` + `if (!cancelled) continue` | none — blind `.eq('id', ...)`, result never checked |
| Listings restored to `active` | yes | **never called** — listings stay `reserved` forever |
| `order_items.active = false` | yes ("frees partial unique index for re-listing") | **never called** — `idx_order_items_active_listing` (migration 035) permanently blocks that listing from ever being ordered again |
| `refund_status` / `refund_amount_cents` / `refunded_at` stamped | yes, via `refundOrder()` | **never set**, even when the cancel UPDATE succeeds |
| Error on the cancel UPDATE itself | impossible to silently lose (guarded select) | swallowed — `await ...update(...)` result is discarded |

So even in the case where this code path runs exactly as intended (a normal sibling-order rollback, not seam #1's leak), the result is an order that's cancelled but un-refund-stamped, with its listings stuck `reserved` and its listing permanently blocked from re-sale. Seam #1 explains why UJRJ specifically never even got *that far*; seam #2 is the reason the compensation can't be trusted even when it does run.

### Two additional defects found while tracing this exact block (in scope — same function, same catch)

**Finding A — double-refund risk.** Before the seller loop, unavailable items already trigger a partial refund (`payment-fulfillment.ts:184-187`, `attemptAutoRefund(..., refundCardCents, 'partial cart refund...')`). If the seller loop *then* throws, the catch fires `attemptAutoRefund(..., expectedEverypayAmountCents, 'cart order creation failed mid-loop')` — and `expectedEverypayAmountCents` is the **total** remaining card amount computed at the top of the function (line 104), before the partial-unavailability refund was subtracted. In any cart that has both unavailable items *and* a mid-loop failure, this issues two overlapping refund calls to EveryPay for the same money. `refundPayment` (`everypay/client.ts`) has no app-side dedup — it's a pass-through. Must subtract what was already refunded.

**Finding B — wallet credit for unavailable items is skipped on mid-loop failure.** The wallet-portion credit-back for unavailable items (`creditWallet(..., refundWalletCents, ...)`) runs at lines 295-306, *after* the seller loop. The catch block returns early at line 291, before line 295 is ever reached. If a cart has wallet-funded unavailable items **and** the seller loop later fails for an unrelated reason, the buyer's wallet is never credited back for those items. The card leg (line 185-187) and the wallet leg (line 295-306) of the *same* unavailable-items refund are split across the loop for no functional reason — they need to move together, before the loop.

**Finding C (raised in review, confirmed) — the unavailable-items refund uses the wrong wallet RPC.** Both unavailable-items wallet credit-backs (lines 152 and 295-306) call `creditWallet`, which calls the `wallet_credit` Postgres RPC. Its own doc-comment in `supabase/migrations/070_atomic_wallet_rpcs.sql:8` says `-- wallet_credit: seller earnings on order completion`. The correct function is `refundToWallet` → `wallet_refund`, added specifically for this in `supabase/migrations/022_disputes.sql:78`: `-- Add 'refund' type for buyer refund credits (separate from seller 'credit' ...)`. This is a real, pre-existing data-classification bug (wrong `wallet_transactions.type`, wrong audit event — `wallet.credit` fires instead of `wallet.refund`), not a style nit — and it sits in the exact lines Finding B already touches.

Tracing the consumer side: `src/app/[locale]/account/wallet/TransactionList.tsx` has no `TYPE_LABELS`/`TYPE_BADGE_VARIANT` entry for `'refund'` at all (only `credit`/`debit`/`withdrawal`), and its sign logic is `txn.type === 'credit' ? '+' : '-'`. So **every** existing buyer refund in the app today (dispute resolutions, deadline auto-cancellations — anything going through `refundOrder()` → `refundToWallet`) already renders with an unstyled lowercase "refund" badge and a misleading "-" in default color, despite being a balance-increasing event. This is a pre-existing, broader UI bug, not caused by this PR. Scope decision: fix the backend misclassification (it's wallet-ledger correctness, the same risk class as the rest of this PR) plus the two missing UI map entries + sign-logic fix it exposes (4 lines, `TransactionList.tsx`) — but this is the full extent of the UI fix; it is not a general wallet-UI audit.

---

## Fix design

### 1. Prevention

Audit result: the fire-and-forget side effects already inside the per-seller loop (`trackServer` via `void`, `debitWallet` via a local try/catch that never rethrows) are already correctly isolated — they cannot trigger this catch. The actual prevention work is making `createOrder()`'s **own** internal compensation observable instead of silently swallowed (seam #1):

`src/lib/services/orders.ts` — check both deletes' `{ error }` in the listings-mismatch branch (and the order delete in the order_items-insert-failure branch) and `Sentry.captureException` on either failing, tagged with `orderId` and which delete failed. The thrown message to the caller is unchanged (`'One or more listings are no longer available'` / `'Failed to create order items: ...'`) — only observability is added; this is not meant to be the thing that prevents data loss (that's fix #2), it's what makes the underlying DB hiccup visible the moment it happens.

### 2. Correct compensation

Replace `createdOrders`-array-driven rollback with a **direct re-query** of `orders` by `cart_group_id` + `status = 'pending_seller'` inside the catch. This is strictly more robust than trusting the in-memory array — it finds a seam-#1-style leaked row regardless of why `createOrder()` failed to report it, and it works identically for single-seller carts (where `createdOrders` would be empty even today).

**Ordering constraint (corrected after review):** every order found must be **cancelled, with its listings restored and its wallet leg refunded, before the single aggregate card refund fires** — not after. The first draft did the aggregate card refund first; if the process died (or anything else went wrong) between that refund and the per-order cancel loop, the result is exactly the incident being fixed: a live, shippable `pending_seller` order whose payment has already gone back to the buyer. Cancel-first means the worst case a crash can produce is `status='cancelled'` + `refund_status='failed'` — a tracked, visible debt — never a live order with money already returned.

This needs three small helpers instead of one, so the card refund's outcome can be threaded into the stamp without it gating the cancel:

```ts
async function claimAndCancelOrder(
  serviceClient: SupabaseClient,
  buyerId: string,
  order: { id: string; order_number: string },
): Promise<boolean> {
  const { data: claimed } = await serviceClient
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: 'system',
    })
    .eq('id', order.id)
    .eq('status', 'pending_seller')
    .select('id')
    .single();

  if (!claimed) return false; // already transitioned by a concurrent retry — idempotent no-op

  const { data: orderItems } = await serviceClient
    .from('order_items')
    .select('listing_id')
    .eq('order_id', order.id);
  const listingIds = (orderItems ?? []).map((i) => i.listing_id);

  if (listingIds.length > 0) {
    const { error: unreserveError } = await serviceClient.rpc('unreserve_listings', {
      p_listing_ids: listingIds, p_buyer_id: buyerId,
    });
    if (unreserveError) {
      Sentry.captureException(unreserveError, {
        tags: { orderId: order.id, orderNumber: order.order_number, phase: 'cart_rollback_listings_restore_failed' },
      });
    }
    const { error: deactivateError } = await serviceClient
      .from('order_items')
      .update({ active: false })
      .eq('order_id', order.id);
    if (deactivateError) {
      Sentry.captureException(deactivateError, {
        tags: { orderId: order.id, orderNumber: order.order_number, phase: 'cart_rollback_order_items_deactivate_failed' },
      });
    }
  }

  return true;
}

async function refundOrderWalletLeg(
  serviceClient: SupabaseClient,
  buyerId: string,
  order: { id: string; order_number: string; buyer_wallet_debit_cents: number },
): Promise<boolean> {
  if (order.buyer_wallet_debit_cents <= 0) return true;
  try {
    await refundToWallet(buyerId, order.buyer_wallet_debit_cents, order.id, 'Rollback: cart order creation failed');
    return true;
  } catch (walletError) {
    console.error(`[Payments] Cart: Wallet rollback refund failed for order ${order.id}:`, walletError);
    Sentry.captureException(walletError, {
      tags: { orderId: order.id, orderNumber: order.order_number, phase: 'cart_rollback_wallet_refund_failed' },
    });
    return false;
  }
}

/**
 * Writes the refund_status stamp unconditionally (needed in Phase 1, before
 * the card outcome is known, so a crash before Phase 3 still leaves a
 * sweepable status instead of null). Only captures to Sentry when
 * captureIfIncomplete=true — Phase 1 always computes 'partial'/'failed'
 * (cardRefundOk is hard-coded false there), so capturing there would alert
 * on every successful rollback. Phase 3 passes true once the real outcome
 * is known.
 */
async function stampRollbackRefundStatus(
  serviceClient: SupabaseClient,
  order: { id: string; order_number: string; total_amount_cents: number; buyer_wallet_debit_cents: number },
  cardRefundOk: boolean,
  walletRefundOk: boolean,
  captureIfIncomplete: boolean,
): Promise<{ refundStatus: 'completed' | 'partial' | 'failed'; refundAmountCents: number }> {
  const refundStatus =
    cardRefundOk && walletRefundOk ? 'completed' :
    !cardRefundOk && !walletRefundOk ? 'failed' : 'partial';
  const refundAmountCents =
    (cardRefundOk ? order.total_amount_cents - order.buyer_wallet_debit_cents : 0) +
    (walletRefundOk ? order.buyer_wallet_debit_cents : 0);

  await serviceClient
    .from('orders')
    .update({ refund_status: refundStatus, refund_amount_cents: refundAmountCents, refunded_at: new Date().toISOString() })
    .eq('id', order.id);

  if (captureIfIncomplete && refundStatus !== 'completed') {
    Sentry.captureException(new Error(`Cart rollback refund ${refundStatus} for order ${order.order_number}`), {
      tags: { orderId: order.id, orderNumber: order.order_number, phase: 'cart_rollback_refund_incomplete' },
    });
  }
  return { refundStatus, refundAmountCents };
}
```

These deliberately do **not** call `refundOrder()` (`order-refund.ts`) for the card leg — that function always attempts its own EveryPay call when `cardAmount > 0`, which would double-refund against the *same* payment reference the aggregate `attemptAutoRefund` call already covers. `refundOrder()`'s contract (do the EveryPay call itself) doesn't fit a scenario where the card leg is refunded once, in aggregate, for N orders. The wallet leg reuses `refundToWallet` (now consistently, per Finding C) and the optimistic-lock + listings-restore + order_items-deactivate shape mirrors `autoCancelOrders` — the part of "the existing atomic path" actually transferable here.

The catch block, in three phases:

```ts
} catch (error) {
  console.error('[Payments] Cart: Failed mid-loop, rolling back created orders:', error);
  Sentry.captureException(error, {
    tags: { cartGroupId: group.id, paymentReference, phase: 'cart_fulfillment_mid_loop' },
    extra: { createdOrderIds: createdOrders.map((o) => o.id) },
  });

  // Re-query rather than trust createdOrders — see Failure seam #1.
  const { data: pendingOrders } = await serviceClient
    .from('orders')
    .select('id, order_number, buyer_wallet_debit_cents, total_amount_cents')
    .eq('cart_group_id', group.id)
    .eq('status', 'pending_seller');

  if (pendingOrders && pendingOrders.length !== createdOrders.length) {
    Sentry.captureException(new Error('Cart rollback found orders not tracked in-memory'), {
      tags: { cartGroupId: group.id, phase: 'cart_fulfillment_stranded_order_detected' },
      extra: { dbOrderIds: pendingOrders.map((o) => o.id), trackedOrderIds: createdOrders.map((o) => o.id) },
    });
  }

  // Phase 1 — cancel + restore listings + deactivate order_items + refund the
  // wallet leg for every pending order FIRST, before any card money moves.
  // A crash here leaves orders cancelled (never live-and-refunded).
  const claimedOrders: NonNullable<typeof pendingOrders> = [];
  const walletOutcomes = new Map<string, boolean>();
  for (const order of pendingOrders ?? []) {
    const claimed = await claimAndCancelOrder(serviceClient, group.buyer_id, order);
    if (!claimed) continue;
    const walletRefundOk = await refundOrderWalletLeg(serviceClient, group.buyer_id, order);
    walletOutcomes.set(order.id, walletRefundOk);
    claimedOrders.push(order);
    // Pessimistic DB stamp for crash-visibility — captureIfIncomplete=false:
    // cardRefundOk is hard-coded false here (the card hasn't run yet), so
    // capturing now would alert on every successful rollback.
    await stampRollbackRefundStatus(serviceClient, order, false, walletRefundOk, false);
  }

  // Phase 2 — the single aggregate card refund, only now that nothing claimed
  // above can still be shipped. Subtract what the pre-loop unavailable-items
  // refund already covered (Finding A) so the card is never refunded twice.
  const remainingCardRefundCents = expectedEverypayAmountCents - refundCardCents;
  let cardRefundOk = true;
  if (remainingCardRefundCents > 0) {
    cardRefundOk = await attemptAutoRefund(
      serviceClient, paymentReference, remainingCardRefundCents, 'cart order creation failed mid-loop'
    );
  }

  // Phase 3 — upgrade every claimed order's refund_status now that the card
  // outcome is known (captureIfIncomplete=true), and fire the audit event.
  for (const order of claimedOrders) {
    const walletRefundOk = walletOutcomes.get(order.id) ?? false;
    const { refundStatus, refundAmountCents } = await stampRollbackRefundStatus(
      serviceClient, order, cardRefundOk, walletRefundOk, true
    );
    void logAuditEvent(serviceClient, {
      actorType: 'system',
      action: 'order.auto_cancelled.system',
      resourceType: 'order',
      resourceId: order.id,
      metadata: { orderNumber: order.order_number, reason: 'system', refundStatus, refundAmountCents },
      retentionClass: 'regulatory',
    });
  }

  // Post-condition canary: after a total rollback, every order tied to this
  // group must be cancelled. Any survivor is the literal UJRJ condition —
  // alert immediately. (Replaces a round-1 "reconciliation" canary that
  // compared claimedOrders' card total against the aggregate refund amount —
  // wrong referent: the order that *triggers* a mid-loop failure usually
  // self-deletes inside createOrder() and never reaches claimedOrders, so
  // that comparison didn't hold even in the routine, non-buggy case.)
  const { data: stillLiveOrders } = await serviceClient
    .from('orders')
    .select('id')
    .eq('cart_group_id', group.id)
    .neq('status', 'cancelled');
  if (stillLiveOrders && stillLiveOrders.length > 0) {
    Sentry.captureException(new Error('Cart rollback left a live order after total rollback'), {
      tags: { cartGroupId: group.id, phase: 'cart_rollback_live_order_survived' },
      extra: { liveOrderIds: stillLiveOrders.map((o) => o.id) },
    });
  }

  await serviceClient.from('cart_checkout_groups').update({ status: 'expired' }).eq('id', group.id);
  return { outcome: 'failed', error: error instanceof Error ? error.message : 'unknown' };
}
```

The mismatch-count Sentry call (right after the re-query, unchanged from round 1) is a deliberate canary: if it ever fires post-fix, seam #1 (or something like it) is still leaking, caught immediately instead of weeks later. It doesn't fire on the routine case either: `createdOrders` and `pendingOrders` both only contain orders whose `createOrder()` call actually returned, so in the normal "one seller fails cleanly" path both are the same length.

An arithmetic money-math canary (comparing the aggregate refund amount against an independently-derived total of *available* items' card value, computed before the loop) is possible but needs to re-derive per-seller shipping outside the loop to do correctly — deferred as a nice-to-have, not required: the post-condition canary above is the one that directly encodes the incident and is unambiguous to get right.

**Finding B fix:** move the wallet credit-back for unavailable items (currently lines 295-306) up to immediately follow the card refund for unavailable items (currently lines 184-187), so both legs of that refund happen together, before the loop, and can't be skipped by a later unrelated failure.

**Finding C fix:** in both unavailable-items call sites (the all-unavailable branch and the partial-unavailable branch moved by Finding B), change `creditWallet(...)` → `refundToWallet(...)`. Same parameter shape, drop-in. Remove `creditWallet` from this file's `@/lib/services/wallet` import once both call sites are changed (it becomes unused). In `src/app/[locale]/account/wallet/TransactionList.tsx`, add `refund: 'Refund'` to `TYPE_LABELS`, `refund: 'success'` to `TYPE_BADGE_VARIANT`, and change the sign logic from `txn.type === 'credit' ? '+' : '-'` to `(txn.type === 'credit' || txn.type === 'refund') ? '+' : '-'` (and the matching color class). This also fixes the display for every pre-existing `refund`-type transaction (disputes, deadline auto-cancellations), not just the cart-rollback case — a side effect, not the goal.

### 3. Idempotency

- The claim-UPDATE's `.eq('status', 'pending_seller')` guard makes `claimAndCancelOrder` itself idempotent: a retried callback or cron run that re-enters the catch for the same group finds the order already `cancelled`, gets `claimed === false`, and skips it without re-refunding or re-cancelling.
- **Verified (round 1, point 2): the top-of-function "does an order already exist for this group" check covers the retry case once at least one order was created.** Both copies of this check — `payment-fulfillment.ts:94-101` and `callback/route.ts:89-96` — query `.eq('cart_group_id', group.id)` with **no status filter**, so a retry sees the now-`cancelled` rows, `existingOrders.length > 0` is true, and the function short-circuits to `'already_exists'`/an early redirect before ever reaching the loop or the catch again. No further `attemptAutoRefund` call is possible once any order exists for the group, cancelled or not.
- **Gap found and fixed: the zero-orders-ever-created edge case.** If the very first `createOrder()` call in a cart fails before producing any row, `pendingOrders` is empty and there is nothing for the existing-orders check to find on a retry. The aggregate card refund still needs to run (the buyer's card was genuinely charged), so today's behavior of re-attempting it doesn't matter on its own — *unless the callback route lets a retry reach `fulfillCartPayment` a second time*. It does, because `callback/route.ts:104` only treats `group.status === 'completed'` as already-handled, not `'expired'` — which is exactly the status this catch sets at the end. A double-fired callback (browser back-button resubmission, retry) for a group that failed with zero orders created would fall through, re-verify with EveryPay, and could re-enter `fulfillCartPayment`, firing a second full-amount card refund. **Fix:** add a `group.status === 'expired'` branch in `handleCartCallback` (`callback/route.ts`), redirecting to the same target as the `'failed'` outcome (`/account/orders?from=cart&group=${group.id}&error=partial_creation`), placed alongside the existing `'completed'` check so it short-circuits before the EveryPay re-verification call. The reconcile-payments cron doesn't need the equivalent fix — it only queries `cart_checkout_groups` where `status = 'pending'` (`reconcile-payments/route.ts:50`), which already excludes `'expired'` groups.
- `attemptAutoRefund`'s own idempotency is bounded by EveryPay's API + the existing `111_refund_idempotency_guard.sql` migration on the order-level refund path; this PR doesn't change that contract, only the amount computed for the aggregate call (Finding A) and the new callback-route guard above.
- The pre-existing TOCTOU gap in `fulfillCartPayment`'s top-of-function "does an order already exist for this group" check — two concurrent invocations (callback + cron) could both pass that check before either inserts — is a known, separate concern already tracked in `prelaunch_audit_followups.md` (cron locking). Not addressed here; the optimistic lock in `claimAndCancelOrder` prevents that race from causing a *double*-rollback, which is the part that matters for this incident.
- **Consciously accepted, named gap (round 2, point 3 — lower-priority, not blocking): the zero-orders-created aggregate refund has no durable marker written before it fires.** In the ≥1-order case, the order rows themselves are the idempotency marker — the no-status-filter existing-orders check (above) catches a retry even after a crash, regardless of when the crash happened. In the zero-orders case (the very first `createOrder()` call in the cart fails before producing any row), nothing is written before `attemptAutoRefund` runs in Phase 2, and the only other marker — `cart_checkout_groups.status = 'expired'` — is written *after* it, as the catch's last line. A crash between the refund succeeding and that status write lets a retry (callback or cron) re-enter `fulfillCartPayment` and refund again: the new `'expired'` guard (above) only protects once that status write has actually committed, and with no order row, neither the stuck-refund sweep nor the deferred detection net (section 4) can see a duplicated refund here — there's nothing in `orders` to query. This window is narrow (zero orders created + card charged + a crash inside a sub-second span) and adjacent to the cron-lock/TOCTOU work already deferred above. The real fix is a `payment_reference`-keyed "refund issued" marker written *before* the EveryPay call — its own idempotency-infrastructure change (new column or table), not a natural extension of this PR's helpers. Accepted as a known gap rather than solved here; add it to `prelaunch_audit_followups.md` alongside the existing TOCTOU entry rather than letting it ride implicitly.

### 4. Detection safety net — designed here, **fast-follow PR, not this one**

Reasoning for deferring: the predicate needs a cross-reference between `orders` and `audit_log` that doesn't fit the existing query helpers cleanly, and the "flag for staff" half needs a delivery mechanism (digest email, mirroring `reconcile-payments`' existing `walletAlertOrders` pattern) that's new surface area. Given fix #2 above closes the actual incident mechanism (and covers single-seller carts too, not just the multi-seller case that triggered seam #2), this is genuinely a defense-in-depth backstop, not the fix itself. Proposed design, ready to implement next:

Add a section to `src/app/api/cron/reconcile-payments/route.ts`, same shape as the existing wallet-retry section:

```
candidates = orders WHERE status NOT IN ('cancelled','completed','disputed','refunded')
                     AND refund_status IS NULL
                     AND everypay_payment_reference IS NOT NULL
JOIN audit_log a ON a.resource_type='payment' AND a.action='payment.refunded'
                AND a.resource_id = orders.everypay_payment_reference
                AND a.created_at > orders.created_at
```

(Two queries + an in-memory join is fine — this should be a near-zero-row case; no need for a SQL function.) For each match:
- `status = 'pending_seller'` → auto-cancel via `claimAndCancelOrder` + `stampRollbackRefundStatus` (exported from `payment-fulfillment.ts` for reuse), tag `phase: 'reconcile_orphaned_refund_pending'` in Sentry — this firing at all means something upstream still leaked.
- `status IN ('accepted','shipped','delivered')` → **do not touch the order or any seller credit.** Send a staff digest email (mirroring `walletAlertOrders`) with order id/number/status/seller/buyer/refund amount for manual review. This is exactly the "seller already credited, don't auto-reverse" case from the brief.

### 5. Observability

- `attemptAutoRefund`'s catch (`payment-fulfillment.ts:58-64`): add `Sentry.captureException(refundError, { tags: { paymentReference, reason, phase: 'auto_refund_failed' }, extra: { amountCents } })`. Today this branch is labeled "CRITICAL" in its own log message but never reaches Sentry — that's the literal gap the incident exposed (no exception, no log).
- The cart-completion catch: covered above (`phase: 'cart_fulfillment_mid_loop'`).
- New canary for an in-memory/DB tracking mismatch at the start of rollback: the `pendingOrders.length !== createdOrders.length` check above.
- New canary for the literal incident condition, checked at the end of rollback: the post-condition `stillLiveOrders` check above (`phase: 'cart_rollback_live_order_survived'`).
- `stampRollbackRefundStatus`'s non-`'completed'` refund status (Phase 3 only — `captureIfIncomplete=true`), and `refundOrderWalletLeg`'s failure: covered above (`phase: 'cart_rollback_refund_incomplete'` / `'cart_rollback_wallet_refund_failed'`).
- `claimAndCancelOrder`'s own two Postgrest calls (`unreserve_listings`, `order_items.active=false`): covered above (`phase: 'cart_rollback_listings_restore_failed'` / `'cart_rollback_order_items_deactivate_failed'`) — this is the same unchecked-error pattern seam #1 exists to kill, caught under review before it shipped in the new helper.
- `createOrder()`'s own delete-failure visibility (seam #1, fix #1): covered above (`phase: 'create_order_rollback_items_delete_failed'` / `'create_order_rollback_order_delete_failed'`).
- **Verified (round 2, point 5): `TransactionList.tsx` is the only behavioral consumer of `wallet_transactions.type` in the codebase.** `grep -rln "'withdrawal'" --include="*.ts" --include="*.tsx" src` (excluding tests), using `'withdrawal'` as the rarest type literal as a probe — the only match is the `WalletTransactionType` union declaration in `src/lib/wallet/types.ts`. No CSV/accounting export, email, or balance display elsewhere switches on this field and would also need the Finding C fix.

**New, inline (not deferred) — minimal stuck-refund sweep, addressing round 1, point 5.** The cancel-first redesign in section 2 means a crash between Phase 1 and Phase 3 can leave an order `cancelled` with `refund_status IN ('failed', 'partial')` — correct (a tracked debt, not a live order), but nothing currently sweeps that state. Add a third section to `reconcile-payments/route.ts`, same shape as the existing wallet-retry section:

```ts
const { data: stuckRefunds } = await serviceClient
  .from('orders')
  .select('id, order_number, buyer_id, seller_id, refund_status, refund_amount_cents, total_amount_cents, updated_at')
  .in('refund_status', ['failed', 'partial'])
  .lt('updated_at', new Date(Date.now() - REFUND_ALERT_AGE_MS).toISOString())
  .limit(BATCH_LIMIT);
```

No `cart_group_id` filter — this also covers pre-existing `refund_status='failed'` orders from disputes and deadline auto-cancellations, which `order-refund.ts`'s `markRefundFailed` doc-comment already says should be visible in a staff "Refund issues" queue that was never actually built. One digest email (mirroring `walletAlertOrders`'s exact pattern in the same file), `Sentry.captureException` per batch run if non-empty, tagged `phase: 'reconcile_stuck_refund_status'`. Alert-only, no auto-retry — matches the existing "MANUAL RESOLUTION NEEDED" convention elsewhere in the codebase.

**Triage guidance (round 2, point 7):** a crash after Phase 2's card refund succeeds but before Phase 3 writes the final stamp leaves `refund_status='failed'` even though the money actually moved — the sweep will surface this as a false debt. That's the safe direction to err (over-flag, not under-flag), but the digest email's body must say so explicitly: *"refund_status may be stale — verify against EveryPay before re-issuing a refund."* Whoever triages this queue needs to reconcile against EveryPay first, not re-refund on sight.

This is deliberately distinct from the deferred detection net in section 4: this sweep catches *known* incomplete states this PR's own design can produce (`refund_status` already set, just not `'completed'`); section 4 catches the *original* incident shape (an order that's still live, with no `refund_status` at all, despite a `payment.refunded` audit event existing). Both are useful; only this one is small enough to ship now (a single-table query, no audit_log cross-reference).

**Out of scope, flagged but not touched:** `order-refund.ts`'s existing "MANUAL RESOLUTION NEEDED" `console.error`s (lines ~113-118, ~131-136) also never reach Sentry. Same gap, different call sites, pre-existing, not introduced or worsened by this incident. Worth its own pass; not bundled here to keep this PR single-concern.

---

## Affected files

- `src/lib/services/payment-fulfillment.ts` — `attemptAutoRefund` (Sentry), unavailable-items refund reorder + wallet-function fix (Findings B + C), catch-block rewrite (re-query + cancel-first three-phase rollback + Finding A amount fix + reconciliation canary + Sentry), new `claimAndCancelOrder`/`refundOrderWalletLeg`/`stampRollbackRefundStatus` helpers, new `import * as Sentry from '@sentry/nextjs'`, `creditWallet` import removed (no longer used after Finding C)
- `src/lib/services/orders.ts` — `createOrder`'s two internal rollback branches get checked deletes + Sentry; new `import * as Sentry from '@sentry/nextjs'`
- `src/app/api/payments/callback/route.ts` — add `group.status === 'expired'` early-return in `handleCartCallback` (idempotency gap found in review, point 2)
- `src/app/api/cron/reconcile-payments/route.ts` — new minimal stuck-refund digest section (round 1, point 5)
- `src/app/[locale]/account/wallet/TransactionList.tsx` — add `refund` entries to `TYPE_LABELS`/`TYPE_BADGE_VARIANT`, fix the +/- sign logic (Finding C's UI companion)
- `src/lib/services/payment-fulfillment.test.ts` — new rollback-path coverage
- `src/lib/services/orders.test.ts` — new rollback-error-visibility coverage
- `src/test/scenarios/payment-edges.test.ts` — new end-to-end multi-seller mid-loop scenario
- `CLAUDE.md` — Audit Events register: extend the `order.auto_cancelled.{reason}` entry's description to note the cart-rollback emission site (reason `'system'`) alongside the existing deadlines-cron emission sites; no new entry needed since `'system'` is already a valid `CancellationReason` and the migration-084 backfill's `LIKE 'order.auto_cancelled.%'` match already covers it

`fulfillCartPayment`'s signature and return type (`CartFulfillmentOutcome`) are unchanged — the `'failed'` outcome shape callers branch on is untouched. The callback route change is additive (a new early-return branch), not a signature change.

## Migration needs

None. All columns used (`refund_status`, `refund_amount_cents`, `refunded_at`, `cancellation_reason`, `everypay_payment_reference`) already exist (confirmed in migrations 035, 069, 089). The `unreserve_listings` RPC already exists (migration 025) and is already called elsewhere in this same cron's sibling code path.

## Test plan

**`src/lib/services/orders.test.ts`** (new `describe('createOrder rollback error visibility')`):
1. Listings-mismatch branch, `order_items` delete returns `{ error }` → `Sentry.captureException` called with `phase: 'create_order_rollback_items_delete_failed'`; function still throws `'One or more listings are no longer available'`.
2. Same branch, both deletes succeed (today's clean path) → no Sentry call.
3. `order_items` insert fails → `orders` delete returns `{ error }` → Sentry called with the order-delete phase tag.

**`src/lib/services/payment-fulfillment.test.ts`** (new `describe('fulfillCartPayment — mid-loop rollback')`, extending the existing `makeClient`/`makeQueryBuilder` factory — needs: a `.rpc()` mock returning `{ data: 1, error: null }` for `unreserve_listings`, `'single'` added to `chainMethods`, and an `order_items` table branch in `makeClient`):
1. Two-seller cart; seller #2's `createOrder` mock rejects after seller #1's resolves (the routine, non-leaking case — seller #2's order self-deletes inside `createOrder()` and never persists) → assert ordering: `claimAndCancelOrder`'s claim-UPDATE (`.eq('status','pending_seller')`) and `unreserve_listings`/`order_items.active=false` for seller #1's order all fire **before** `attemptAutoRefund` is called; aggregate refund called once with `remainingCardRefundCents` (not double-counting any pre-loop partial refund); final `refund_status='completed'`/`refund_amount_cents` stamped; `order.auto_cancelled.system` audit event fired with `refundAmountCents` present in metadata (round 2, point 6); Sentry captured for the mid-loop phase; the post-condition `stillLiveOrders` check finds nothing and does **not** fire.
2. **Alert-fatigue regression (round 2, point 2) — the case round 1's own canary would have broken on:** same two-seller setup as test 1, full success on both legs → assert `Sentry.captureException` is **never** called with `phase: 'cart_rollback_refund_incomplete'` (Phase 1's pessimistic stamp must stay silent; only Phase 3 can capture, and Phase 3's outcome here is `'completed'` so it doesn't either). This is the test that round 1's mis-specified reconciliation canary would have failed.
3. **Crash-ordering regression (round 2, point 1):** mock `attemptAutoRefund` to reject/throw — assert the sibling order is *already* `status='cancelled'` (Phase 1 completed) by the time the card refund is attempted, i.e. the cancel-UPDATE mock was called before the refund mock, not after.
4. Idempotency: claim-UPDATE mocked to return no row (already cancelled) → `refundToWallet` and the listings/order_items steps are **not** called for that order; function returns cleanly; assert zero further `attemptAutoRefund` calls if `pendingOrders` is empty.
5. `attemptAutoRefund` mock rejects (EveryPay down) → `cardRefundOk=false` threaded through; sibling order still gets `status='cancelled'` (from Phase 1, unconditionally) but `refund_status='failed'`; Sentry captured for `'cart_rollback_refund_incomplete'` (Phase 3 only, `captureIfIncomplete=true`).
6. Wallet refund (`refundToWallet`) mock rejects for a sibling order with `buyer_wallet_debit_cents > 0` → `refund_status='partial'`; Sentry captured for `'cart_rollback_wallet_refund_failed'`.
7. **`claimAndCancelOrder` error visibility (round 2, point 4):** mock the `unreserve_listings` RPC to return `{ error }` → assert `Sentry.captureException` called with `phase: 'cart_rollback_listings_restore_failed'`; same pattern for the `order_items.active=false` update returning `{ error }` → `phase: 'cart_rollback_order_items_deactivate_failed'`. In both cases the order is still cancelled (the claim already succeeded) and the rollback continues — these are visibility additions, not new throw paths.
8. Finding A regression test: unavailable item triggers the pre-loop partial refund, then the seller loop also fails → assert `attemptAutoRefund` for the mid-loop case is called with `expectedEverypayAmountCents - refundCardCents`, not the full amount.
9. Finding B regression test: unavailable item with wallet allocation, seller loop subsequently fails → assert `refundToWallet` (not `creditWallet`) for the unavailable item's wallet portion is still called.
10. Finding C regression test: unavailable item, no mid-loop failure (happy path otherwise) → assert `refundToWallet` is called for the unavailable-items wallet leg and `creditWallet` is never called anywhere in the module.
11. Detect-mismatch canary: stub the `orders` re-query to return one more row than `createdOrders` tracks → assert the `'cart_fulfillment_stranded_order_detected'` Sentry call fires.
12. **Post-condition canary (round 2, point 1's replacement for the broken reconciliation check):** stub the post-Phase-3 re-query (`status != 'cancelled'`) to return a row → assert `'cart_rollback_live_order_survived'` Sentry call fires with that order's id in `extra.liveOrderIds`. And the negative case: normal two-seller rollback (test 1's setup) → assert this query returns empty and the Sentry call does **not** fire.

**`src/app/[locale]/account/wallet/TransactionList.tsx`** (no existing test file for this component — recommended, not blocking, given the small surface area; minimum bar per CLAUDE.md is browser verification of the rendered "Refund" badge + "+" sign for a `type: 'refund'` transaction): if added, a Vitest+RTL render test asserting `type: 'refund'` renders label "Refund", `success` badge variant, and `+` sign — mirrors the existing `credit` case.

**`src/app/api/payments/callback/route.test.ts`** (new, or extend if a test file already covers this route): `group.status === 'expired'` → assert early redirect, `getPaymentStatus`/`fulfillCartPayment` never called (round 1, point 2).

**`src/app/api/cron/reconcile-payments/route.test.ts`** (new, or extend): an order with `refund_status='failed'` older than the alert threshold → digest email sent, Sentry captured with `phase: 'reconcile_stuck_refund_status'`; an order with `refund_status='completed'` → not included.

**`src/test/scenarios/payment-edges.test.ts`** (new `it('I12: ...')`, matching the file's existing I-numbered convention):
End-to-end multi-seller scenario through the real mock chain used by I3/I5/I6 — two sellers, one order succeeds, the other's listing becomes unavailable mid-loop — asserting final persisted state: surviving sibling order has `status='cancelled'`, `cancellation_reason='system'`, `refund_status='completed'`, `refund_amount_cents = total_amount_cents`; its listings are `status='active'`; its `order_items.active=false`.

Run `pnpm verify` after implementation (type-check + lint + test + build) per CLAUDE.md.

## Idempotency / concurrency notes

- `claimAndCancelOrder`'s optimistic lock is the load-bearing idempotency mechanism for this fix — covered above under "3. Idempotency."
- The re-query-by-`cart_group_id` approach means a retry of the *entire* `fulfillCartPayment` call (e.g. reconcile-payments cron picking up the same group after a transient failure) is safe: the top-of-function existing-orders check (verified, no status filter) still short-circuits to `'already_exists'` once any order exists for the group; if it somehow re-enters the catch, every `claimAndCancelOrder` call for an already-cancelled order is a no-op.
- The zero-orders-created edge case (verified gap, now fixed): closed by the new `group.status === 'expired'` guard in `callback/route.ts` — see section 3 above.
- **Verified (round 1, point 6): `orders.cart_group_id` is nullable at the schema level** (`migrations/025_cart_checkout.sql:33`, `ADD COLUMN cart_group_id UUID;`, no `NOT NULL`) — a re-query keyed on it is only as robust as every cart-originated INSERT actually setting it. Confirmed this call site does: `fulfillCartPayment` always passes `cartGroupId: group.id` (`payment-fulfillment.ts:229`) and `createOrder()` always includes it when truthy (`orders.ts:131`, `...(params.cartGroupId ? { cart_group_id: params.cartGroupId } : {})`), and `group.id` is never empty. No other code path inserts into `orders` with a cart-shaped intent but a null `cart_group_id`, so the re-query's coverage is complete for this fix's scope.
- Cancel-first ordering (section 2) bounds the worst case of a mid-rollback crash to `cancelled` + `refund_status` not yet `'completed'` — never a live order with money already returned. The new stuck-refund sweep (section 5) is what eventually clears that state; until it runs, the debt is visible on the order row itself (`refund_status`), not silent.
- Known, unaddressed, pre-existing race: concurrent callback + cron both passing the top-of-function "no existing orders" check before either inserts. Tracked separately (`prelaunch_audit_followups.md`); not introduced or worsened by this PR.

## Deploy / rollback considerations

Pure application-code change, no schema migration, no feature flag needed — safe to deploy directly. If a regression is found post-deploy, reverting this PR's commit returns to today's behavior (worse, but not a new failure mode). No data backfill is required for this PR itself (UJRJ's correction is a separate one-off — see below).

Note (round 1, point 7): this fix reuses `cart_checkout_groups.status = 'expired'` for the mid-loop-failure case, same as the existing session-timeout and all-unavailable cases. All three are distinct causes collapsed into one terminal status — pre-existing, not introduced here. Acceptable for now; if "why did this group expire" ever needs to be queryable, that's a follow-up (e.g. a `expired_reason` column), not blocking this PR.

## Blockers vs lower-priority items

**Blocking this PR (must do):**
- Fix #1 (orders.ts delete-error visibility)
- Fix #2 (catch-block re-query + cancel-first three-phase rollback: `claimAndCancelOrder` / `refundOrderWalletLeg` / `stampRollbackRefundStatus`)
- Finding A (double-refund amount fix)
- Finding B (wallet-credit reorder)
- Finding C (`creditWallet`→`refundToWallet` for unavailable-items refund + `TransactionList.tsx` label/badge/sign fix)
- Callback-route `'expired'`-status idempotency guard (round 1, point 2)
- Post-condition "live order survived" canary, replacing round 1's mis-specified reconciliation canary (round 2, point 1)
- `captureIfIncomplete` split so Phase 1's pessimistic stamp doesn't alert on every successful rollback (round 2, point 2)
- `claimAndCancelOrder`'s own two Postgrest calls error-checked + Sentry (round 2, point 4)
- `refundAmountCents` restored to the Phase 3 audit-event metadata (round 2, point 6)
- Minimal stuck-refund digest sweep in `reconcile-payments`, with the EveryPay-reconciliation triage note (round 1 point 5; round 2 point 7)
- `attemptAutoRefund` Sentry wiring
- Full test plan above
- CLAUDE.md audit-event register note

**Lower-priority / explicitly deferred (do not bundle):**
- Full audit-log-cross-reference detection net in `reconcile-payments` for the original incident shape (design above, fast-follow PR) — distinct from the minimal stuck-refund sweep above, which is in scope
- Zero-orders-created aggregate-refund idempotency gap (round 2, point 3) — consciously accepted, to be logged in `prelaunch_audit_followups.md` alongside the existing TOCTOU entry, not solved in this PR
- `order-refund.ts`'s pre-existing missing Sentry calls on "MANUAL RESOLUTION NEEDED" paths (separate, broader observability pass)
- Buyer-facing email/notification when this rollback fires (today there is none; this PR doesn't add one — pure data-integrity + observability scope)
- The top-of-function TOCTOU race (tracked in `prelaunch_audit_followups.md`)
- A dedicated Vitest+RTL test for `TransactionList.tsx`'s `'refund'` rendering (round 2, point 5's UI companion) — recommended, browser-verify at minimum

## Out of scope — separate one-off (do NOT bundle)

Correcting STG-20260606-UJRJ's stale `everypay_payment_state`/`refund_status` and the €28.80 seller-credit decision. This needs a staff/accounting decision (claw back from seller wallet vs. write off) before any data is touched, and should run as its own reviewed one-shot script against production, not as part of this code fix.
