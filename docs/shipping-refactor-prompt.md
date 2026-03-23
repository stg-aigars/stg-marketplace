# Shipping Flow Refactor: Labels → T2T Parcel Terminology

> **For Claude Code:** Read all referenced files before starting. Work through tasks sequentially. Commit after each task with the suggested message. Run `pnpm build` after each task to verify nothing breaks.

## Context

STG uses Unisend Terminal-to-Terminal (T2T) shipping. In T2T, **there is no PDF label**. The seller receives a **parcel ID** (a numeric code) which they enter at any Unisend terminal to drop off the package. The current codebase has leftover "label" terminology from an earlier design that assumed PDF label generation. This refactor cleans up the shipping flow to match T2T reality.

## Architecture Decisions (already made)

1. **Shipping logic lives in a separate module** from order transitions — it touches Unisend infrastructure and is not directly part of order state management.
2. **If Unisend fails during accept, the order is still accepted.** The seller's intent to fulfill shouldn't be blocked by a temporary Unisend outage. A `shipping_error` is stored on the order so the seller can retry.
3. **A retry-shipping API route exists** so sellers can retry when the initial Unisend call failed.
4. **The email `sendShippingLabelToSeller`** becomes `sendShippingInstructionsToSeller` — it tells the seller their parcel ID and to visit any Unisend terminal. This email complements the in-app display (seller sees the info immediately in the UI, but also has it in their inbox when they're physically at the terminal later).
5. **Dead code is removed:** `getLabelPdfBuffer()`, `downloadLabelFromStorage()`, and any PDF-related logic.
6. **`docs/reference/unisend/` files are deleted** — they are near-duplicates of production code that have already drifted.

## Pre-work: Read These Files

Before starting, read these files to understand the current state:

- `src/lib/services/order-transitions.ts` — the `acceptOrder()` function (current inline parcel creation)
- `src/lib/services/unisend/label-service.ts` — the standalone label generation module (to be replaced)
- `src/lib/services/unisend/prepare-and-generate-label.ts` — shared workflow (to be replaced)
- `src/lib/services/unisend/format-label-error.ts` — error formatting (to be renamed)
- `src/lib/services/unisend/client.ts` — low-level Unisend API client (unchanged)
- `src/lib/services/unisend/types.ts` — Unisend types (unchanged)
- `src/lib/services/unisend/tracking-service.ts` — tracking sync (unchanged)
- `src/lib/services/unisend/index.ts` — barrel exports (to be updated)
- `src/lib/email/index.ts` — email stubs (to be updated)
- `src/app/api/orders/[id]/accept/route.ts` — accept API route
- `memory/shipping_architecture.md` — memory file (to be updated)
- `memory/shipping_model.md` — memory file (to be updated)

---

## Task 1: Add `shipping_error` column to orders table

**Why:** When Unisend fails during accept, we need to store the error so the seller can see what went wrong and retry.

**File to create:** `supabase/migrations/008_shipping_error_column.sql`

```sql
-- Add shipping_error column for storing Unisend parcel creation failures.
-- Used when the seller accepts an order but Unisend API is unavailable.
-- The seller can retry shipping later via the retry-shipping endpoint.
ALTER TABLE orders ADD COLUMN shipping_error TEXT;
```

Apply via Supabase MCP `apply_migration` tool if available.

**Commit:** `feat: add shipping_error column to orders table`

---

## Task 2: Create `shipping.ts` — the new shipping orchestration module

**Why:** Replaces `label-service.ts` and `prepare-and-generate-label.ts` with T2T-correct terminology and cleaner separation.

**File to create:** `src/lib/services/unisend/shipping.ts`

This module should:

1. **Export `createOrderShipping(ctx)`** — the main function called by `acceptOrder()`:
   - Takes a context object with: orderId, orderNumber, seller info (name, phone, email, country), buyer info (name, phone), destination (country, terminalId, terminalName, terminalAddress), parcelSize
   - Normalizes phones using `detectPhoneCountry()` and `composePhoneNumber()` from `@/lib/phone-utils`
   - Validates receiver phone against `PHONE_FORMATS` for destination country
   - Validates seller phone with `isValidPhoneNumber()`
   - Validates both countries are Baltic
   - Calls `createAndShipParcel()` from `./client`
   - On success: updates order with `unisend_parcel_id`, `barcode`, `tracking_url` (using service client), clears `shipping_error`
   - On success: fires `sendShippingInstructionsToSeller` email (non-blocking)
   - On failure: updates order with `shipping_error` (the user-friendly error message)
   - Returns `{ success: true, parcelId, barcode, trackingUrl }` or `{ success: false, error: string }`

2. **Export `retryOrderShipping(orderId)`** — for the retry route:
   - Loads the order with joined profiles (seller, buyer) using service client
   - Verifies order is in 'accepted' status and has a `shipping_error` (i.e., shipping previously failed)
   - Verifies order does NOT already have a `unisend_parcel_id` (don't double-create)
   - Calls `createOrderShipping()` with the data from the order
   - Returns the same result shape

3. **Export `getTrackingUrl(barcode)`** — kept from label-service.ts, constructs `https://www.post.lt/siuntu-sekimas/?parcels={barcode}`

4. **Export `updateOrderShippingError(orderId, error)`** — writes `shipping_error` to the order

**Important patterns to preserve from `prepare-and-generate-label.ts`:**
- Phone normalization (detectPhoneCountry + composePhoneNumber)
- Receiver phone validation against PHONE_FORMATS for the destination country
- The "prefix-only" empty phone check (phone equals just the country prefix = effectively empty)
- Console logging with `[Shipping ${orderId}]` prefix for debugging
- Non-blocking email send with `.catch()`

**Do NOT include from the old files:**
- `getLabelPdfBuffer()` — T2T has no PDF labels
- `downloadLabelFromStorage()` — T2T has no stored labels
- `generateShippingLabel()` — this was a wrapper that added unnecessary indirection; the new `createOrderShipping()` calls `createAndShipParcel()` directly
- Any reference to `label_url`, `label_generated_at`, `label_error` columns (these don't exist in the DB and shouldn't)
- The `labelUrl = \`unisend://terminal/${parcelId}\`` synthetic URL — the parcel ID is stored directly as `unisend_parcel_id`

**Commit:** `feat: add shipping orchestration module (replaces label-service)`

---

## Task 3: Rename `format-label-error.ts` → `format-shipping-error.ts`

**Why:** Terminology alignment.

**Steps:**

1. Create `src/lib/services/unisend/format-shipping-error.ts` with the same content as `format-label-error.ts`, but:
   - Rename the function: `formatLabelError` → `formatShippingError`
   - Update the JSDoc: "Format Unisend shipping errors into user-friendly messages"
   - Update the fallback message: `'Unknown error generating shipping label'` → `'Unknown error creating shipping parcel'`

2. Create `src/lib/services/unisend/format-shipping-error.test.ts` — copy from `format-label-error.test.ts` with:
   - Updated import path
   - Updated function name in all test calls
   - Updated expected fallback message string

3. Delete `src/lib/services/unisend/format-label-error.ts`
4. Delete `src/lib/services/unisend/format-label-error.test.ts`

5. Update imports in `shipping.ts` (Task 2) to use the new name.

6. Run `pnpm test` to verify the renamed tests pass.

**Commit:** `refactor: rename format-label-error to format-shipping-error`

---

## Task 4: Refactor `acceptOrder()` to use the shipping module

**Why:** Remove inline Unisend logic from order transitions. The shipping module handles all Unisend interaction.

**File to modify:** `src/lib/services/order-transitions.ts`

**Changes to `acceptOrder()`:**

1. Remove the inline `CreateParcelRequest` construction and `createAndShipParcel()` call
2. Remove the `createAndShipParcel` import from `./unisend/client`
3. Remove the `UNISEND_DEFAULT_PARCEL_SIZE` import from `./unisend/types`
4. Remove the `CreateParcelRequest` type import from `./unisend/types`
5. Remove the `TerminalCountry` type import from `./unisend/types` (if no longer needed elsewhere in the file)
6. Import `createOrderShipping` from `./unisend/shipping`

New flow for `acceptOrder()`:
```
1. loadOrder() — same as before
2. Verify seller_id and status — same as before  
3. transitionOrder() to 'accepted' — do this FIRST (with seller_phone in extraUpdates)
4. Call createOrderShipping() — AFTER the order is accepted
   - If success: return { order, parcelId, barcode }
   - If failure: the shipping module already stored shipping_error on the order.
     Return { order, parcelId: null, barcode: null, shippingError: error }
     (Do NOT throw — the order is already accepted)
5. Send sendOrderAcceptedToBuyer email — same as before
```

**Update the return type** of `acceptOrder()`:
```ts
Promise<{ 
  order: OrderRow; 
  parcelId: number | null; 
  barcode: string | null;
  shippingError?: string;
}>
```

**Update the accept API route** (`src/app/api/orders/[id]/accept/route.ts`):
- Handle the new return shape
- If `shippingError` is present, still return 200 (order was accepted) but include the shipping error in the response so the UI can show it:
```ts
return NextResponse.json({
  success: true,
  order: { id: order.id, status: order.status },
  parcelId,
  barcode,
  shippingError, // null if shipping succeeded, string if it failed
});
```

**Commit:** `refactor: acceptOrder uses shipping module, graceful Unisend failure`

---

## Task 5: Create retry-shipping API route

**Why:** When Unisend was down during accept, the seller needs a way to retry.

**File to create:** `src/app/api/orders/[id]/retry-shipping/route.ts`

```ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';
import { retryOrderShipping } from '@/lib/services/unisend/shipping';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { response, user } = await requireAuth();
  if (response) return response;

  try {
    const result = await retryOrderShipping(params.id, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      parcelId: result.parcelId,
      barcode: result.barcode,
      trackingUrl: result.trackingUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create shipping';
    console.error('[Orders] Retry shipping failed:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
```

The `retryOrderShipping()` function in shipping.ts should:
- Verify `user.id === order.seller_id` (only seller can retry)
- Verify order is in `accepted` status
- Verify `shipping_error` is set (there was a previous failure)
- Verify `unisend_parcel_id` is null (no parcel was created yet)
- Call `createOrderShipping()` with data extracted from the order

**Commit:** `feat: add retry-shipping API route for failed Unisend calls`

---

## Task 6: Rename email stub and implement it

**Why:** `sendShippingLabelToSeller` → `sendShippingInstructionsToSeller` with actual content.

**File to modify:** `src/lib/email/index.ts`

1. Rename `sendShippingLabelToSeller` to `sendShippingInstructionsToSeller`
2. Update the parameter interface — remove anything label-specific, keep:
   ```ts
   {
     sellerName: string;
     sellerEmail: string;
     orderNumber: string;
     orderId: string;
     buyerName: string;
     destinationTerminalName: string;
     destinationTerminalAddress: string;
     parcelId: string;       // The code to enter at the terminal
     barcode?: string;       // For tracking (assigned after drop-off)
     trackingUrl?: string;
   }
   ```
3. Implement using the existing `EmailLayout` + `templateStyles` pattern. The email content should:
   - Greet the seller by name
   - Tell them the order has been accepted and shipping is ready
   - Show the **parcel ID prominently** (this is what they enter at the terminal)
   - Show destination terminal name and address
   - Explain the steps: "Visit any Unisend terminal → Enter parcel ID → Place the game in the locker"
   - Link to the order page
   - If barcode/trackingUrl available, show tracking info

4. Create the template file: `src/lib/email/templates/shipping-instructions-seller.tsx`

5. Update `shipping.ts` (Task 2) to import and call the renamed function.

**Commit:** `feat: implement shipping instructions email for sellers (replaces label stub)`

---

## Task 7: Delete dead files

**Files to delete:**
- `src/lib/services/unisend/label-service.ts`
- `src/lib/services/unisend/prepare-and-generate-label.ts`
- `docs/reference/unisend/label-service.ts`
- `docs/reference/unisend/prepare-and-generate-label.ts`
- `docs/reference/unisend/format-label-error.ts`
- `docs/reference/unisend/format-label-error.test.ts`
- `docs/reference/unisend/tracking-service.ts`
- `docs/reference/unisend/client.ts`
- `docs/reference/unisend/types.ts`
- `docs/reference/unisend/types.test.ts`
- `docs/reference/unisend/index.ts`

Also delete `docs/reference/cache.ts` and `docs/reference/phone-utils.ts` — these are duplicates of production code that have already served their purpose.

After deletion, if `docs/reference/` only contains the `everypay/` directory, delete the everypay reference files too:
- `docs/reference/everypay/client.ts`
- `docs/reference/everypay/types.ts`
- `docs/reference/everypay/types.test.ts`
- `docs/reference/everypay/classify-error.ts`
- `docs/reference/everypay/classify-error.test.ts`

Then remove the `docs/reference/` directory entirely.

**Before deleting**, verify no production code imports from `docs/reference/`. Search for `from '@/docs/reference'` or `from '../../docs/reference'` — there should be none (these are reference-only files).

**Commit:** `chore: delete reference duplicates and dead label-generation code`

---

## Task 8: Update barrel exports

**File to modify:** `src/lib/services/unisend/index.ts`

Update to export from the new files:
```ts
export * from './types';
export * from './client';
export { default as unisendClient, getUnisendClient } from './client';
export { createOrderShipping, retryOrderShipping, getTrackingUrl } from './shipping';
export { formatShippingError } from './format-shipping-error';
```

Remove any exports that referenced the deleted files.

**Commit:** `chore: update unisend barrel exports`

---

## Task 9: Update memory files

**File to modify:** `memory/shipping_architecture.md`

Update the "Implementation" section to reflect the new file structure:
```
- `types.ts` — All types, SHIPPING_PRICES matrix, PHONE_FORMATS, parcel sizes, error classes
- `client.ts` — OAuth token management, all Unisend API methods (low-level)
- `shipping.ts` — Shipping orchestration: createOrderShipping(), retryOrderShipping(), getTrackingUrl()
- `format-shipping-error.ts` — User-friendly error formatting from UnisendValidationError
- `tracking-service.ts` — syncTrackingForOrder(), syncAllActiveOrders() (cron)
```

Update the "Label Generation Flow" section → rename to "Shipping Creation Flow":
```
1. Seller accepts order → acceptOrder() transitions to 'accepted'
2. createOrderShipping() called (non-blocking — failure doesn't roll back accept)
3. Normalize buyer/seller phones via phone-utils
4. Validate phones against destination country format (PHONE_FORMATS)
5. Create parcel + initiate shipping via Unisend API
6. On success: store parcelId, barcode, trackingUrl on order; send email to seller
7. On failure: store shipping_error on order; seller can retry via retry-shipping route
```

Remove any mention of:
- "label-service.ts"
- "prepare-and-generate-label.ts"  
- "Label URL"
- "label_url", "label_generated_at", "label_error"
- PDF generation or storage

**File to modify:** `memory/shipping_model.md`

No label references here, but verify and fix if any exist.

**File to modify:** `memory/MEMORY.md`

Verify the shipping entries are accurate — no changes likely needed.

**Commit:** `docs: update memory files for shipping refactor (labels → T2T parcels)`

---

## Task 10: Verify everything

1. `pnpm build` passes
2. `pnpm test` passes (including the renamed format-shipping-error tests)
3. `grep -r "label" src/lib/services/unisend/ --include="*.ts" | grep -iv "// "` — should return NO results referencing "label" in function names, file names, or variable names (comments are OK)
4. `grep -r "label-service\|prepare-and-generate-label\|formatLabelError\|getLabelPdf\|downloadLabel" src/` — should return ZERO results
5. `grep -r "label_url\|label_generated_at\|label_error" src/` — should return ZERO results
6. `ls docs/reference/` — directory should not exist
7. No TypeScript `any` casts were introduced

---

## Summary

| # | Task | Type |
|---|------|------|
| 1 | Add `shipping_error` column | Migration |
| 2 | Create `shipping.ts` module | New file |
| 3 | Rename format-label-error → format-shipping-error | Rename + tests |
| 4 | Refactor `acceptOrder()` | Modify |
| 5 | Create retry-shipping API route | New file |
| 6 | Rename + implement shipping instructions email | New file + modify |
| 7 | Delete dead files | Cleanup |
| 8 | Update barrel exports | Modify |
| 9 | Update memory files | Docs |
| 10 | Verify everything | Verification |
