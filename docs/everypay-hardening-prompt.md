# EveryPay Payment Flow Hardening

> **For Claude Code:** Read all referenced files before starting. Work through tasks sequentially. Commit after each task with the suggested message. Run `pnpm build` after each task to verify nothing breaks.

## Context

STG uses EveryPay (Swedbank) for payments. The buyer is redirected to EveryPay's hosted payment page, then EveryPay redirects back to our callback URL after payment. The callback verifies the payment and creates the order.

The current flow has several gaps where a successful payment can result in no order and no refund. This prompt hardens the payment callback, unifies order numbering across checkout sessions and orders, and adds defensive checks.

## Pre-work: Read These Files

Before starting, read these files to understand the current state:

- `src/app/api/payments/create/route.ts` — creates checkout session + EveryPay payment
- `src/app/api/payments/callback/route.ts` — handles EveryPay redirect, creates order
- `src/lib/services/everypay/client.ts` — EveryPay HTTP wrapper
- `src/lib/services/everypay/types.ts` — payment states, request/response types
- `src/lib/services/everypay/classify-error.ts` — error classification
- `src/lib/services/orders.ts` — `createOrder()`, `generateOrderNumber()`
- `src/lib/services/pricing.ts` — pricing calculations
- `src/lib/checkout/types.ts` — `CheckoutSession` interface
- `src/app/[locale]/checkout/[listingId]/page.tsx` — checkout page (error messages)

---

## Task 1: Unify order numbering across checkout sessions and orders

**Why:** Currently checkout sessions use a UUID as their EveryPay `order_reference`, while orders get a human-readable `STG-YYYYMMDD-XXXX` number generated after payment. This means EveryPay's dashboard, bank statements, and transaction exports show UUIDs that can't be correlated to order numbers without a database lookup. Unifying the two makes support and reconciliation much easier.

### Step 1a: Add `order_number` column to checkout sessions

**File to create:** `supabase/migrations/009_checkout_session_order_number.sql`

```sql
-- Add order_number to checkout_sessions so the same STG-YYYYMMDD-XXXX
-- identifier flows from checkout → EveryPay → callback → order.
-- This makes EveryPay dashboard, bank statements, and support queries
-- all reference the same human-readable number.
ALTER TABLE checkout_sessions ADD COLUMN order_number TEXT UNIQUE;
```

Apply via Supabase MCP `apply_migration` tool if available.

### Step 1b: Update checkout session type

**File to modify:** `src/lib/checkout/types.ts`

Add `order_number` to the interface:

```ts
export interface CheckoutSession {
  id: string;
  order_number: string;    // ← add this
  listing_id: string;
  buyer_id: string;
  terminal_id: string;
  terminal_name: string;
  terminal_country: string;
  buyer_phone: string;
  amount_cents: number;
  status: 'pending' | 'completed' | 'expired';
  created_at: string;
}
```

### Step 1c: Update payment create route

**File to modify:** `src/app/api/payments/create/route.ts`

1. Import `generateOrderNumber` from `@/lib/services/orders`
2. Generate the order number BEFORE creating the checkout session
3. Store it on the session AND send it to EveryPay as `order_reference`

Change the checkout session insert from:
```ts
const { data: session, error: sessionError } = await serviceClient
  .from('checkout_sessions')
  .insert({
    listing_id: listingId,
    buyer_id: user.id,
    terminal_id: terminalId,
    terminal_name: terminalName,
    terminal_country: terminalCountry,
    buyer_phone: buyerPhone,
    amount_cents: pricing.totalChargeCents,
    status: 'pending',
  })
  .select('id')
  .single();
```

To:
```ts
const orderNumber = generateOrderNumber();

const { data: session, error: sessionError } = await serviceClient
  .from('checkout_sessions')
  .insert({
    order_number: orderNumber,
    listing_id: listingId,
    buyer_id: user.id,
    terminal_id: terminalId,
    terminal_name: terminalName,
    terminal_country: terminalCountry,
    buyer_phone: buyerPhone,
    amount_cents: pricing.totalChargeCents,
    status: 'pending',
  })
  .select('id, order_number')
  .single();
```

And change the EveryPay call from:
```ts
const paymentResponse = await createPayment(
  pricing.totalChargeCents,
  session.id,          // UUID
  callbackUrl,
  ...
);
```

To:
```ts
const paymentResponse = await createPayment(
  pricing.totalChargeCents,
  session.order_number,  // STG-YYYYMMDD-XXXX
  callbackUrl,
  ...
);
```

### Step 1d: Update payment callback route

**File to modify:** `src/app/api/payments/callback/route.ts`

The callback receives `order_reference` from EveryPay, which is now `STG-YYYYMMDD-XXXX`. Update the session lookup:

From:
```ts
const { data: session, error: sessionError } = await serviceClient
  .from('checkout_sessions')
  .select('*')
  .eq('id', orderReference)
  .single<CheckoutSession>();
```

To:
```ts
const { data: session, error: sessionError } = await serviceClient
  .from('checkout_sessions')
  .select('*')
  .eq('order_number', orderReference)
  .single<CheckoutSession>();
```

Also update the idempotency check's order-for-session lookup (in the `session.status === 'completed'` block) to use `order_number`:
```ts
const { data: orderForSession } = await serviceClient
  .from('orders')
  .select('id')
  .eq('order_number', session.order_number)
  .single();
```

### Step 1e: Update `createOrder()` to accept an existing order number

**File to modify:** `src/lib/services/orders.ts`

Add an optional `orderNumber` field to `CreateOrderParams`:

In `src/lib/orders/types.ts`:
```ts
export interface CreateOrderParams {
  // ... existing fields ...
  orderNumber?: string;   // ← add: pre-generated from checkout session
}
```

In `createOrder()`, use it instead of generating a new one:
```ts
const orderNumber = params.orderNumber ?? generateOrderNumber();
```

### Step 1f: Pass the order number from callback to createOrder

**File to modify:** `src/app/api/payments/callback/route.ts`

In the `createOrder()` call, add `orderNumber`:
```ts
const order = await createOrder({
  // ... existing fields ...
  orderNumber: session.order_number,  // ← add this
});
```

**Commit:** `feat: unify order numbering — same STG-YYYYMMDD-XXXX from checkout through EveryPay to order`

---

## Task 2: Reorder callback logic — verify payment BEFORE checking session expiry

**Why:** The current callback checks session expiry BEFORE verifying payment with EveryPay. If a payment takes over 30 minutes (slow 3DS, bank delays), the callback rejects the session as expired even though the payment succeeded. The buyer loses money with no order and no refund.

**File to modify:** `src/app/api/payments/callback/route.ts`

Move the session expiry block so it runs AFTER payment verification AND only for non-successful payments.

The new logic order should be:

```
1. Extract payment_reference and order_reference from URL
2. Idempotency: check if order already exists for this payment_reference
3. Look up checkout session by order_number (from Task 1)
4. Handle already-completed sessions
5. Verify payment with EveryPay (getPaymentStatus)
6. If payment SUCCEEDED → skip expiry check, proceed to create order
   (A legitimate slow payment should still be honored)
7. If payment FAILED → check expiry for better error messaging, then redirect with error
```

Remove the current session expiry block entirely from its current location. Instead, add this logic AFTER the payment verification check:

```ts
// Verify payment with EveryPay
let paymentStatus;
try {
  paymentStatus = await getPaymentStatus(paymentReference);
} catch (error) {
  console.error('[Payments] Failed to verify payment:', error);
  return NextResponse.redirect(
    `${env.app.url}/checkout/${session.listing_id}?error=verification_failed`
  );
}

// Payment succeeded — proceed regardless of session age
if (SUCCESSFUL_STATES.has(paymentStatus.payment_state)) {
  // ... continue to order creation (rest of the happy path) ...
}

// Payment did NOT succeed
// Mark expired sessions (for cleanup) then redirect with appropriate error
if (session.status === 'pending') {
  const SESSION_TTL_MS = 30 * 60 * 1000;
  const sessionAge = Date.now() - new Date(session.created_at).getTime();
  if (sessionAge > SESSION_TTL_MS) {
    await serviceClient
      .from('checkout_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id)
      .eq('status', 'pending');
  }
}

const errorCategory = classifyPaymentError(
  paymentStatus.payment_state,
  paymentStatus.error
);
return NextResponse.redirect(
  `${env.app.url}/checkout/${session.listing_id}?error=${errorCategory}`
);
```

**Commit:** `fix: verify payment before checking session expiry — honor legitimate slow payments`

---

## Task 3: Add payment reference and amount verification

**Why:** The callback receives `payment_reference` and `order_reference` from URL query params (not signed by EveryPay). While `getPaymentStatus()` verifies the payment is real, we don't check that it belongs to the right session or that the amount matches. A user with access to any valid EveryPay payment reference could theoretically pair it with someone else's checkout session.

**File to modify:** `src/app/api/payments/callback/route.ts`

After calling `getPaymentStatus()` and confirming it's a successful payment, add two verification checks BEFORE creating the order:

```ts
// Verify the payment belongs to this checkout session
if (paymentStatus.order_reference !== session.order_number) {
  console.error(
    `[Payments] order_reference mismatch: EveryPay returned "${paymentStatus.order_reference}" but session has "${session.order_number}"`
  );
  return NextResponse.redirect(
    `${env.app.url}/checkout/${session.listing_id}?error=verification_failed`
  );
}

// Verify the payment amount matches what we charged
const expectedAmount = (session.amount_cents / 100).toFixed(2);
if (paymentStatus.amount && paymentStatus.amount !== expectedAmount) {
  console.error(
    `[Payments] Amount mismatch: EveryPay charged €${paymentStatus.amount} but session expected €${expectedAmount}`
  );
  return NextResponse.redirect(
    `${env.app.url}/checkout/${session.listing_id}?error=verification_failed`
  );
}
```

Place these checks right after the `SUCCESSFUL_STATES` check, before any listing re-fetch or order creation.

**Commit:** `fix: verify payment reference ownership and amount match in callback`

---

## Task 4: Auto-refund on all payment-succeeded-but-order-failed paths

**Why:** There are two places where a successful payment results in no order: (a) listing became unavailable between payment and callback, (b) `createOrder()` fails (race condition on listing reservation). In both cases, the buyer's money is taken but no order exists.

**File to modify:** `src/app/api/payments/callback/route.ts`

### Step 4a: Create a refund helper at the top of the callback file (or as a local function)

```ts
async function attemptAutoRefund(
  paymentReference: string,
  amountCents: number,
  reason: string
): Promise<boolean> {
  try {
    await refundPayment(paymentReference, amountCents);
    console.log(`[Payments] Auto-refunded ${paymentReference}: ${reason}`);
    return true;
  } catch (refundError) {
    console.error(
      `[Payments] CRITICAL: Auto-refund failed for ${paymentReference} (${reason}):`,
      refundError
    );
    return false;
  }
}
```

Import `refundPayment` from `@/lib/services/everypay/client` at the top of the file.

### Step 4b: Add refund when listing is no longer available

Find the listing availability check:
```ts
if (!listing || listing.status !== 'active') {
  console.error(`[Payments] Payment ${paymentReference} succeeded but listing ${session.listing_id} is no longer available`);
  return NextResponse.redirect(
    `${env.app.url}/checkout/${session.listing_id}?error=listing_unavailable`
  );
}
```

Replace with:
```ts
if (!listing || listing.status !== 'active') {
  console.error(`[Payments] Payment ${paymentReference} succeeded but listing ${session.listing_id} is no longer available`);
  await attemptAutoRefund(paymentReference, session.amount_cents, 'listing unavailable after payment');
  return NextResponse.redirect(
    `${env.app.url}/checkout/${session.listing_id}?error=listing_unavailable`
  );
}
```

### Step 4c: Add refund when order creation fails

Find the `createOrder` catch block:
```ts
} catch (error) {
  console.error('[Payments] Failed to create order:', error);
  return NextResponse.redirect(
    `${env.app.url}/checkout/${session.listing_id}?error=order_creation_failed`
  );
}
```

Replace with:
```ts
} catch (error) {
  console.error('[Payments] Failed to create order:', error);
  await attemptAutoRefund(paymentReference, session.amount_cents, `order creation failed: ${error instanceof Error ? error.message : 'unknown'}`);
  return NextResponse.redirect(
    `${env.app.url}/checkout/${session.listing_id}?error=order_creation_failed`
  );
}
```

### Step 4d: Update the error message for `listing_unavailable` in the checkout page

**File to modify:** `src/app/[locale]/checkout/[listingId]/page.tsx`

In the `errorMessages` map, update to inform the buyer about the refund:
```ts
listing_unavailable: 'This listing was purchased while you were paying. Your payment will be refunded automatically.',
order_creation_failed: 'Something went wrong creating your order. Your payment will be refunded automatically. If you do not see the refund within a few business days, please contact support.',
```

**Commit:** `fix: auto-refund when payment succeeds but order creation fails`

---

## Task 5: Add `ReadonlySet` to payment state classifier sets

**Why:** The payment state sets (`SUCCESSFUL_STATES`, `FAILED_STATES`, `PENDING_STATES`) are used for classification only — they should never be mutated at runtime. `ReadonlySet` makes this explicit and prevents accidental `.add()` or `.delete()`.

**File to modify:** `src/lib/services/everypay/types.ts`

Change:
```ts
export const SUCCESSFUL_STATES = new Set<EveryPayPaymentState>([
  'authorised',
  'settled',
]);

export const FAILED_STATES = new Set<EveryPayPaymentState>([
  'failed',
  'abandoned',
  'voided',
]);

export const PENDING_STATES = new Set<EveryPayPaymentState>([
  'initial',
  'sent_for_processing',
  'waiting_for_3ds_response',
  'waiting_for_sca',
  'confirmed_3ds',
]);
```

To:
```ts
export const SUCCESSFUL_STATES: ReadonlySet<EveryPayPaymentState> = new Set([
  'authorised',
  'settled',
]);

export const FAILED_STATES: ReadonlySet<EveryPayPaymentState> = new Set([
  'failed',
  'abandoned',
  'voided',
]);

export const PENDING_STATES: ReadonlySet<EveryPayPaymentState> = new Set([
  'initial',
  'sent_for_processing',
  'waiting_for_3ds_response',
  'waiting_for_sca',
  'confirmed_3ds',
]);
```

Run `pnpm build` — `ReadonlySet` supports `.has()` which is the only method used on these sets. The test file uses `.has()` and `.size` which are both on `ReadonlySet`.

**Commit:** `fix: use ReadonlySet for payment state classifier sets`

---

## Task 6: Harden EveryPay API response parsing

**Why:** The EveryPay client assumes `res.json()` always succeeds. If EveryPay returns a non-JSON response during maintenance (HTML error page), the client throws an unhandled JSON parse error instead of a clean `EveryPayError`.

**File to modify:** `src/lib/services/everypay/client.ts`

In the `request()` function, wrap the JSON parsing:

Find:
```ts
  const data = await res.json();
```

Replace with:
```ts
  let data;
  try {
    data = await res.json();
  } catch {
    throw new EveryPayError(
      `EveryPay API returned non-JSON response (${res.status})`,
      res.status
    );
  }
```

**Commit:** `fix: handle non-JSON EveryPay responses gracefully`

---

## Task 7: Add checkout session cleanup for orphan sessions

**Why:** Every checkout attempt creates a `pending` session. If the buyer abandons payment, the session stays `pending` forever. Over time these accumulate. A cleanup mechanism marks old pending sessions as expired.

### Step 7a: Create a cleanup API route

**File to create:** `src/app/api/cron/cleanup-sessions/route.ts`

```ts
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour — generous, covers slow payments

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const cutoff = new Date(Date.now() - SESSION_TTL_MS).toISOString();

  const { data, error } = await serviceClient
    .from('checkout_sessions')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .select('id');

  if (error) {
    console.error('[Cron] Failed to clean up sessions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = data?.length ?? 0;
  if (count > 0) {
    console.log(`[Cron] Expired ${count} orphan checkout sessions`);
  }

  return NextResponse.json({ expired: count });
}
```

This route is designed to be called by an external cron service (Coolify cron, or a simple `curl` from the server's crontab). It uses the `CRON_SECRET` environment variable for authentication.

### Step 7b: Add an index for the cleanup query

**File to create:** `supabase/migrations/010_checkout_session_cleanup_index.sql`

```sql
-- Partial index for efficient cleanup of orphan checkout sessions.
-- Only indexes pending sessions, which is the subset the cron job queries.
-- The index from 004_checkout_session_indexes.sql covers (status, created_at)
-- but this migration adds the order_number index for the new lookup pattern.
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_order_number
  ON checkout_sessions(order_number) WHERE order_number IS NOT NULL;
```

Apply via Supabase MCP `apply_migration` tool if available.

**Commit:** `feat: add cron route for orphan checkout session cleanup`

---

## Task 8: Update memory files

**File to modify:** `memory/payment_architecture.md`

In the "EveryPay Integration" section, update:

- Add: "Callback verifies `order_reference` and `amount` match the checkout session before creating orders"
- Add: "Auto-refund on all paths where payment succeeds but order creation fails (listing unavailable, race condition)"
- Change: "Order reference encoding: base64({listingId}:{buyerId})" → "Order reference: STG-YYYYMMDD-XXXX (same identifier used for checkout session, EveryPay reference, and final order number)"
- Add: "Orphan checkout sessions cleaned up by cron (`/api/cron/cleanup-sessions`)"

In the "Payment Flow" section, add step between payment verification and order creation:
```
6. Verify order_reference matches session, verify amount matches
7. Auto-refund if listing no longer available
```

**Commit:** `docs: update payment architecture memory for callback hardening`

---

## Task 9: Verify everything

1. `pnpm build` passes
2. `pnpm test` passes (EveryPay type tests should still pass with `ReadonlySet`)
3. Review the callback route logic order:
   - Idempotency check → session lookup → session-already-completed check → payment verification → reference verification → amount verification → listing check (with refund) → order creation (with refund)
4. `grep -r "session\.id" src/app/api/payments/` — should NOT appear as an EveryPay `order_reference` argument
5. `grep -r "order_number" src/lib/checkout/types.ts` — should show the new field
6. `grep -r "attemptAutoRefund\|refundPayment" src/app/api/payments/callback/route.ts` — should show refund calls in both failure paths
7. `grep -r "ReadonlySet" src/lib/services/everypay/types.ts` — should show 3 matches
8. No TypeScript `any` casts were introduced

---

## Summary

| # | Task | Type | Severity |
|---|------|------|----------|
| 1 | Unify order numbering (checkout session → EveryPay → order) | Feature | Medium |
| 2 | Reorder callback: verify payment before session expiry | Fix | Critical |
| 3 | Verify payment reference ownership and amount | Fix | High |
| 4 | Auto-refund on all payment-succeeded-but-no-order paths | Fix | Critical |
| 5 | `ReadonlySet` on payment state sets | Fix | Low |
| 6 | Handle non-JSON EveryPay responses | Fix | Low |
| 7 | Orphan checkout session cleanup cron | Feature | Low |
| 8 | Update memory files | Docs | — |
| 9 | Verify everything | Verification | — |
