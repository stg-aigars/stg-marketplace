# Carrier-Provider Abstraction — Implementation Plan

**Status:** awaiting sign-off. No code written.
**Scope:** refactor only. Unisend stays the sole provider. Zero behaviour change for Baltic orders.
**Goal:** a second shipping carrier can be added later by writing one provider module and one registry row, without touching checkout, cart, order lifecycle, or accounting.

---

## 0. Files read

Carrier module: `src/lib/services/unisend/{index,types,client,shipping,tracking-service,format-shipping-error,filter-terminals}.ts` and their co-located tests.

Consumers: `src/lib/orders/{timeline,types,actual-terminal}.ts`; `src/lib/services/{payment-fulfillment,order-transitions,order-deadlines,orders,tracking}.ts`; `src/lib/api/checkout-validation.ts`; `src/lib/phone-utils.ts`; `src/lib/seo/listing-json-ld.ts`; `src/lib/{env,csp}.ts`.

Routes: `src/app/api/cron/sync-tracking/route.ts`; `src/app/api/terminals/route.ts`; `src/app/api/payments/{cart-create,cart-wallet-pay}/route.ts`; `src/app/api/orders/[id]/retry-shipping/route.ts`.

Pages / components: `src/app/[locale]/{cart/page,checkout/page,checkout/CheckoutForm,listings/[id]/page,orders/[id]/page}.tsx`; `src/components/checkout/{TerminalMap,TerminalPicker,TerminalPopupContent,TerminalSelectorWithMap}.tsx`; `src/components/orders/{LockerFinder,OrderStageHelper,OrderDetailClient,OrderActions,UnifiedTimeline}.tsx`.

DB: `supabase/migrations/{001,002,008,025,041,059,061,074,075,096}*.sql`.

Tests: `src/test/scenarios/{shipping,delivery,seller-response,completion}.test.ts`; `src/lib/services/order-transitions.test.ts`; `src/lib/orders/timeline.test.ts`; `src/components/orders/UnifiedTimeline.test.tsx`; `src/lib/seo/listing-json-ld.test.ts`; `src/lib/services/unisend/{types,filter-terminals,format-shipping-error}.test.ts`.

Accounting cross-check: `src/lib/accounting/{checklist,lifecycle-events,mapping}.ts`, `supabase/migrations/096_accounting_seeds.sql`.

Historical context: `docs/shipping-refactor-prompt.md` (the executed 2025 T2T-terminology refactor), `memory/shipping_architecture.md` (now partly stale — it still describes `types.ts` as owning the price matrix, which this plan changes).

---

## 1. Verification of your stated couplings

All five are accurate. Corrections and additions below.

### 1.1 — `TerminalCountry` / `TERMINAL_COUNTRIES` / `isTerminalCountry` — **confirmed**

They live in `src/lib/services/unisend/types.ts` and are used as the app's supported-markets type. `TerminalOption` and `toTerminalOption` have the same problem: `TerminalOption` is a UI/DTO shape used by five components that have nothing to do with Unisend's wire format.

Complete list of files importing these symbols from the carrier module (20 files):

| Symbol | Importers |
|---|---|
| `TerminalCountry` (type) | `lib/api/checkout-validation.ts`, `lib/phone-utils.ts`, `lib/seo/listing-json-ld.ts`, `lib/services/payment-fulfillment.ts`, `lib/services/unisend/client.ts`, `lib/services/unisend/shipping.ts`, `app/api/payments/cart-create/route.ts`, `app/api/payments/cart-wallet-pay/route.ts`, `app/[locale]/cart/page.tsx`, `app/[locale]/checkout/page.tsx`, `app/[locale]/checkout/CheckoutForm.tsx`, `components/checkout/TerminalMap.tsx`, `components/checkout/TerminalSelectorWithMap.tsx`, `components/orders/OrderStageHelper.tsx`, `components/orders/LockerFinder.tsx` |
| `TERMINAL_COUNTRIES` | `lib/seo/listing-json-ld.ts` |
| `isTerminalCountry` | `lib/api/checkout-validation.ts`, `lib/seo/listing-json-ld.ts`, `app/api/terminals/route.ts`, `app/[locale]/cart/page.tsx`, `app/[locale]/listings/[id]/page.tsx`, `app/[locale]/orders/[id]/page.tsx`, `components/orders/OrderDetailClient.tsx` |
| `TerminalOption` / `toTerminalOption` | `lib/services/unisend/filter-terminals.ts`, `app/[locale]/checkout/page.tsx`, `app/[locale]/checkout/CheckoutForm.tsx`, `app/[locale]/orders/[id]/page.tsx`, `components/checkout/{TerminalMap,TerminalPicker,TerminalPopupContent}.tsx`, `components/checkout/TerminalSelectorWithMap.tsx`, `components/orders/{LockerFinder,OrderStageHelper,OrderDetailClient}.tsx` |

Plus test files: `lib/seo/listing-json-ld.test.ts`, `lib/services/unisend/filter-terminals.test.ts`, `components/checkout/TerminalPopupContent.test.tsx`.

Also note `BALTIC_COUNTRIES` (local const in `shipping.ts`) and the literal arrays `['LT','LV','EE']` appearing three times inside `client.ts` (`getAllTerminals`, `clearTerminalCache`) — four independent restatements of the same market list.

### 1.2 — Shipping price matrix — **confirmed, with a hard constraint you should know about**

`SHIPPING_PRICES_CENTS` / `getShippingPriceCents` / `getMinShippingPriceCents` are in the carrier module. Six consumers: `payment-fulfillment.ts`, `cart-create/route.ts`, `cart-wallet-pay/route.ts`, `cart/page.tsx`, `CheckoutForm.tsx`, `listings/[id]/page.tsx`, plus `listing-json-ld.ts` reading the raw matrix.

Two of those consumers (`cart/page.tsx`, `CheckoutForm.tsx`) are **client components** calling the function synchronously inside `useMemo`. A third (`listing-json-ld.ts`) precomputes the full 3×3 `SHIPPING_DETAILS` and `RETURN_POLICY` objects **at module load**, synchronously. This is decisive for the static-vs-DB decision in §4.

### 1.3 — `PHONE_FORMATS` — **confirmed, but it is doing two jobs**

`PHONE_FORMATS` is keyed by `TerminalCountry` and lives in the carrier module, but `phone-utils.ts` uses it for two structurally different purposes:

- `isBalticPhoneNumber()` / `isValidPhoneNumber()` / `validatePhone()` — "is this a well-formed LV/LT/EE mobile number?" That is a **market** fact, carrier-independent.
- `shipping.ts` uses `PHONE_FORMATS[destCountry].regex` to enforce "the receiver's phone prefix must match the destination country". That is a **carrier policy** — Unisend rejects the parcel otherwise. A different carrier may not care.

The refactor should split these: the regexes move to `markets/`, the "must match destination" rule stays in the Unisend provider.

### 1.4 — `tracking_events` raw carrier vocabulary — **confirmed, blast radius larger than stated**

`tracking_events` (migration 041) stores `event_type` and `state_type` as raw Unisend strings with no carrier column. `UNIQUE (order_id, state_type, event_timestamp)` is the dedupe key, enforced through `add_tracking_event` (`ON CONFLICT ... DO NOTHING`, `RETURN FOUND`), hardened in 059/061.

Four modules — not one — branch on Unisend string literals:

- `lib/orders/timeline.ts` — `TrackingStateType` imported from the carrier module and used as half of `TimelineEntry.key`; `LABEL_CREATED`, `PARCEL_DELIVERED`, `RECEIVED_TERMINAL`, `NOTIFICATIONS_INFORMED`, `RECEIVED_TERMINAL_OUT`, `HIDDEN_EVENT_TYPES = {RECEIVED_LC, DELIVERY_TRANSFER}`.
- `lib/orders/actual-terminal.ts` — filters on `RECEIVED_TERMINAL` / `NOTIFICATIONS_INFORMED`, and parses a Unisend-specific `location` string format.
- `components/orders/UnifiedTimeline.tsx` — `LABELS`, `TRACKING_ICONS`, `EVENT_TYPE_OVERRIDES` and `ERROR_KEYS` all keyed by raw Unisend strings.
- `lib/services/unisend/tracking-service.ts` — auto-transition triggers on `PARCEL_DELIVERED`, `PARCEL_RECEIVED`, `RETURNING`, and the ready-for-pickup notification on `RECEIVED_TERMINAL` / `NOTIFICATIONS_INFORMED`.

**Latent pre-existing defect worth recording:** the UNIQUE key omits `event_type`. `RECEIVED_TERMINAL` and `NOTIFICATIONS_INFORMED` share `state_type = 'ON_THE_WAY'`; if Unisend ever emits both with an identical `event_timestamp`, the second is silently dropped by `ON CONFLICT DO NOTHING`. `timeline.ts` already has explicit dedupe logic for exactly that pair, so today this is invisible. It is **not** caused by this refactor and fixing it is **not** behaviour-neutral (more rows would appear). See §6.3 and Open Question Q4.

### 1.5 — `getTrackingUrl` / `BALTIC_COUNTRIES` — **confirmed**

`getTrackingUrl` in `shipping.ts` hardcodes `https://unisend.lv/en/tracking/?code=…`. `BALTIC_COUNTRIES = ['LV','LT','EE']` is a file-local const in the same file.

### 1.6 — Couplings your list did not mention

These matter for a second carrier and are cheap to fix inside this refactor:

1. **`orders.shipping_method` is never written by application code.** `createOrder()` in `src/lib/services/orders.ts` does not set it; every order gets `'unisend_t2t'` from the migration-002 column DEFAULT. The only read is `tracking-service.ts`'s `.eq('shipping_method', 'unisend_t2t')`. A second carrier cannot ride a column default — the value must become an explicit, resolver-derived write.
2. **`cart_checkout_groups` has no carrier column.** Orders are created from the group in `fulfillCartPayment`; the group is where the buyer's destination is captured, so it is the natural place to resolve and persist the carrier *before* payment, then have `createOrder` inherit it.
3. **The label's sender address is STG's, not the seller's.** `shipping.ts` hardcodes `companyName: 'Second Turn Games'`, `countryCode: 'LV'`, `Ēvalda Valtera iela 5/35, Rīga, LV-1021`, phone `+37126779625`. `seller.country` is used only to decide whether a customs content declaration is attached. Any provider interface must not assume `sender` derives from the seller's address.
4. **`tracking_sync_state` is a single global row** (`id INTEGER PRIMARY KEY DEFAULT 1`, `CONSTRAINT single_row CHECK (id = 1)`). One carrier-agnostic high-water mark cannot serve two carriers with independent APIs and clock skew.
5. **Carrier-specific config is spread across three places:** `env.unisend.{apiUrl,username,password}` in `lib/env.ts`, `https://*.unisend.com` in the `connect-src` directive in `lib/csp.ts`, and `unisend:*` cache-key prefixes in `client.ts`.
6. **`index.ts` does not export `cancelOrderShipment`,** yet `order-transitions.ts` and `order-deadlines.ts` both import it directly from `'./shipping'`. The barrel is already not the real boundary.
7. **User-facing copy names the carrier** in `app/[locale]/help/page.tsx`, `app/[locale]/help/packing/page.tsx`, `components/marketing/TrustBand.tsx` (logo asset `/unisend_logo.svg`), `lib/email/index.ts` (subject line), and `lib/email/templates/shipping-instructions-seller.tsx`. Out of scope for the refactor — flagged so it is not discovered late.

---

## 2. Current-state map

### 2.1 Modules and exported symbols

**`src/lib/services/unisend/types.ts`** — mixed bag of four unrelated concerns.
Wire types: `AuthRequest`, `AuthResponse`, `Terminal`, `ParcelSize`, `ParcelType`, `PlanCode`, `CreateParcelRequest`, `ParcelResponse`, `ShippingInitiateRequest`, `ShippingInitiateResponse`, `BarcodeInfo`, `TrackingStateType`, `TrackingEvent`, `ValidationErrorItem`, `ApiErrorResponse`, `UnisendValidationError`, `UnisendApiError`, `UNISEND_DEFAULT_PARCEL_SIZE`, `ParcelSizeInfo`, `PARCEL_SIZES`.
Market types: `TerminalCountry`, `TERMINAL_COUNTRIES`, `isTerminalCountry`, `PhoneFormat`, `PHONE_FORMATS`.
Pricing: `SHIPPING_PRICES_CENTS`, `getShippingPriceCents`, `getMinShippingPriceCents`.
UI DTO / helpers: `TerminalOption`, `toTerminalOption`, `FIELD_NAME_MAP`, `ERROR_MESSAGES`, `getUserFriendlyFieldName`, `getUserFriendlyErrorMessage`.

**`client.ts`** — OAuth token cache (in-memory L1 + `@/lib/cache` L2), auth circuit breaker, `apiRequest`, `handleApiError`, `normalizeEventDate` (Europe/Vilnius naive-datetime fix). Exports `getTerminals`, `getAllTerminals`, `createParcel`, `initiateShipping`, `getParcelDetail`, `getBarcodes`, `getTrackingEvents`, `getTrackingEventsBulk`, `cancelShipment`, `createAndShipParcel`, `clearTerminalCache`, `clearTokenCache`, `UnisendClient`, `getUnisendClient`, default singleton.

**`shipping.ts`** — `ShippingContext`, `ShippingResult`, `BALTIC_COUNTRIES` (local), `getTrackingUrl`, `updateOrderShippingError`, `createOrderShipping`, `retryOrderShipping`, `cancelOrderShipment`.

**`tracking-service.ts`** — `AUTO_SHIP_MAX_AGE_MS`, `SYNC_SAFETY_MARGIN_MS`, `processOrderEvents` (private), `syncAllActiveOrders`.

**`format-shipping-error.ts`** — `formatShippingError`. **`filter-terminals.ts`** — `filterTerminals`. **`index.ts`** — barrel (incomplete, see §1.6.6).

### 2.2 Application seams

| Seam | Location | Today |
|---|---|---|
| Quote a rate | `payment-fulfillment.ts`, `cart-create`, `cart-wallet-pay`, `cart/page.tsx`, `CheckoutForm.tsx`, `listings/[id]/page.tsx` | direct `getShippingPriceCents(origin, dest)` |
| Rate → JSON-LD | `listing-json-ld.ts` | raw `SHIPPING_PRICES_CENTS` read at module load |
| List pickup points | `app/api/terminals/route.ts`, `checkout/page.tsx` (`getAllTerminals`), `orders/[id]/page.tsx` (`getTerminals`) | direct client calls |
| Validate destination | `checkout-validation.ts` (`validateTerminalInput`, `parseCartCheckoutBody`) | `isTerminalCountry` + `validatePhone` |
| Create shipment | `order-transitions.ts:acceptOrder` | `createOrderShipping(ctx)` |
| Retry shipment | `app/api/orders/[id]/retry-shipping/route.ts` | `retryOrderShipping(orderId, userId)` |
| Cancel shipment | `order-transitions.ts:declineOrder`, `order-deadlines.ts` (auto-cancel) | `cancelOrderShipment(orderId)` |
| Fetch tracking | `app/api/cron/sync-tracking/route.ts` → `syncAllActiveOrders` | `getTrackingEventsBulk(barcodes, dateFrom)` |
| Persist tracking | `tracking-service.ts` | `supabase.rpc('add_tracking_event', …)` with raw provider strings |
| Render tracking | `timeline.ts` → `UnifiedTimeline.tsx`; `actual-terminal.ts` | raw literal branching |
| Build tracking URL | `shipping.ts` | hardcoded `unisend.lv` |

### 2.3 Database objects

| Object | Migration | Notes |
|---|---|---|
| `orders.terminal_id/name/country` | 001 | destination snapshot; `terminal_address/city/postal_code` added later |
| `orders.unisend_parcel_id`, `barcode`, `tracking_url`, `shipping_method` (`TEXT DEFAULT 'unisend_t2t'`, no CHECK), `buyer_phone`, `seller_phone` | 002 | `idx_orders_unisend_parcel_id` dropped in 059 |
| `orders.shipping_error` | 008 | |
| `orders.unisend_request_id` | 075 | |
| `cart_checkout_groups` (`terminal_*`, `buyer_phone`) | 025 | no carrier column |
| `tracking_events` + `add_tracking_event(uuid,text,text,text,text,text,timestamptz)` | 041; `search_path=''` in 059; body qualified in 061; RLS policy re-created in 059 | `UNIQUE (order_id, state_type, event_timestamp)`; `idx_tracking_events_order_timestamp` |
| `tracking_sync_state` | 074 | single row, `CHECK (id = 1)` |
| `accounts` `5410-UN` "Accrued shipping" (parent `5410`) | 096 | referenced by `ACCRUAL_SUB_ACCOUNTS` in `lib/accounting/checklist.ts` |

Latest migration on `main`: `132_get_bookkeeping_summary_backport.sql`. New migrations start at `133`.

---

## 3. Proposed target structure

```
src/lib/markets/
  index.ts              barrel
  countries.ts          SupportedCountry, SUPPORTED_COUNTRIES, isSupportedCountry
  phone-formats.ts      PhoneFormat, PHONE_FORMATS (keyed by SupportedCountry)

src/lib/shipping/
  index.ts              barrel — the ONLY import path for consumers outside lib/shipping
  types.ts              ShippingProvider, ShippingMethod, ShippingContext, ShippingResult,
                        PickupPoint, ProviderTrackingEvent, ShippingEventCode
  registry.ts           SHIPPING_PROVIDERS, getShippingProvider(method), isKnownShippingMethod
  resolve.ts            resolveShippingMethod({ originCountry, destinationCountry })
  rates.ts              quoteShippingCents(...), quoteMinShippingCents(...) — registry-backed
  tracking-sync.ts      provider-agnostic sync loop (was unisend/tracking-service.ts)
  tracking-vocabulary.ts ShippingEventCode union + predicates (isArrivalCode, isHiddenCode, …)
  providers/
    unisend/
      index.ts          the ShippingProvider implementation object
      client.ts         (moved as-is)
      wire-types.ts     (was types.ts, minus market/pricing/DTO concerns)
      shipment.ts       (was shipping.ts, minus getTrackingUrl/BALTIC_COUNTRIES)
      tariff.ts         UNISEND_RATES_CENTS + quote functions
      tracking-map.ts   (state_type, event_type) → ShippingEventCode
      format-error.ts   (was format-shipping-error.ts)
      filter-terminals.ts (moved as-is)
```

`PickupPoint` replaces `TerminalOption` as the UI-facing DTO. It is field-identical to today's `TerminalOption` (`id`, `name`, `city`, `address`, `postalCode`, `countryCode`, `latitude`, `longitude`) so no component prop shape changes — only the import path and the type name.

### 3.1 The `ShippingProvider` interface

Derived from the existing `ShippingContext` / `ShippingResult` rather than invented:

```ts
export type ShippingMethod = 'unisend_t2t';   // widened when a carrier is added

export interface ShippingProvider {
  readonly method: ShippingMethod;
  readonly displayName: string;

  /** Origin/destination pairs this provider will carry. Consulted by resolveShippingMethod. */
  serves(originCountry: string, destinationCountry: string): boolean;

  /** Synchronous by contract — two client components and a module-load precompute depend on it. */
  quoteShippingCents(origin: SupportedCountry, destination: SupportedCountry): number | null;
  quoteMinShippingCents(origin: SupportedCountry): number | null;

  createShipment(ctx: ShippingContext): Promise<ShippingResult>;
  retryShipment(orderId: string, userId: string): Promise<ShippingResult>;
  cancelShipment(orderId: string): Promise<void>;

  listPickupPoints(country?: SupportedCountry): Promise<PickupPoint[]>;

  fetchTrackingEvents(refs: string[], since?: string): Promise<ProviderTrackingEvent[]>;
  buildTrackingUrl(shipmentRef: string | undefined): string | undefined;
}
```

`ShippingContext` and `ShippingResult` keep their current field shapes verbatim, with two renames for provider-neutrality that do not change any value:

- `ShippingContext.destination.terminalId` / `terminalName` → `destination.pickupPointId` / `pickupPointName`. (`destination.country`, `receiver`, `seller`, `buyer`, `parcelSize`, `items` unchanged.)
- `ShippingResult` success arm `{ success: true; parcelId: number; barcode: string; trackingUrl?: string }` → `{ success: true; shipmentRef: string; carrierRef: string | null; trackingUrl?: string }`, where `shipmentRef` carries today's `barcode` and `carrierRef` carries `String(parcelId)`. Callers that surface `parcelId`/`barcode` to JSON (`retry-shipping` route, `acceptOrder`'s return type) keep emitting the same JSON keys by mapping at the edge, so client contracts are untouched.

**Interface notes to sign off on:**

- `quoteShippingCents` is the one **synchronous** method. That is a deliberate constraint, not an oversight — see §4.
- `cancelShipment(orderId)` keeps today's DB-reading, never-throwing, fire-and-forget shape (it self-resolves the parcel id and writes the `shipment.cancelled` audit event). Making it take a `shipmentRef` instead would push the DB read to three call sites for no gain.
- `retryShipment(orderId, userId)` keeps the current ownership/status/idempotency guards inside the provider. They are Unisend-agnostic in substance ("only seller", "only when `accepted`", "only when `shipping_error` set", "never when a parcel already exists"), so a follow-up may hoist them into `lib/shipping/` — deliberately **not** in this refactor, to keep each PR one concern.
- `fetchTrackingEvents` returns **normalised** events (see §6.1). Raw provider strings ride along on the same object so nothing is lost.

### 3.2 Carrier resolution — one place, named

```ts
// src/lib/shipping/resolve.ts
export function resolveShippingMethod(route: {
  originCountry: string;
  destinationCountry: string;
}): ShippingMethod | null
```

First-match-wins over an ordered registry, using each provider's `serves()`. Today exactly one provider matches when both countries are in `SUPPORTED_COUNTRIES`, and nothing matches otherwise — which is the current behaviour, since `getShippingPriceCents` already returns `null` for unknown countries and `createOrderShipping` already rejects non-Baltic origins/destinations.

It is destination-derived in the sense that matters — the buyer never picks a carrier and no carrier field appears in any checkout request body — but the signature takes **both** countries because the rate matrix is already origin×destination and a future print-at-home carrier will almost certainly be scoped by destination *within* an origin set. Taking only the destination would force a second lookup at every rate call site. Flagging in case you want the narrower signature (Q1).

Call sites: `cart-create/route.ts` and `cart-wallet-pay/route.ts` resolve once per seller group and persist the result; `payment-fulfillment.ts` reads the persisted value; `rates.ts` resolves internally so the six quote call sites stay one-liners.

### 3.3 Discriminator: `orders.shipping_method`, registry — not CHECK

Use the existing column. Do **not** add a parallel one.

**Recommendation: registry-validated, no DB CHECK constraint.** Reasons:

- The set of valid values is owned by `SHIPPING_PROVIDERS` in TypeScript. A CHECK duplicates it in a second place that can only be changed by a migration, so adding a carrier becomes a two-artifact change with an ordering hazard (deploy-before-migrate writes a value the CHECK rejects; migrate-before-deploy is fine but must be remembered).
- The column is not a security boundary. It is written only by service-role code paths (`createOrder`) from a resolver output, never from request input.
- The codebase precedent is the accounting `MAPPING_TABLE` — a TypeScript registry with a mutual-exclusivity test rather than a DB enum.

What we add instead, in PR 4:
- `isKnownShippingMethod(value): value is ShippingMethod` in `registry.ts`, plus a test asserting every registry key round-trips.
- `NOT NULL DEFAULT 'unisend_t2t'` on the column (it is currently nullable with a default, and `OrderRow.shipping_method` is typed `string | null` — the null case is unreachable but propagates through the type system).
- A `COMMENT ON COLUMN orders.shipping_method` pointing at `src/lib/shipping/registry.ts` as the authority.

If you would rather have the DB enforce it, say so (Q2) — it is a one-line CHECK, and the cost is only the ordering discipline above.

---

## 4. Rate-lookup seam — static const, recommended

`quoteShippingCents(origin, destination)` and `quoteMinShippingCents(origin)` in `src/lib/shipping/rates.ts`, delegating to the resolved provider's tariff. The Unisend tariff moves to `providers/unisend/tariff.ts` with the same nine values.

**Recommendation: keep it a static const. Do not introduce a DB rate table.**

Reasoning, in order of weight:

1. **Two consumers are client components.** `cart/page.tsx` and `CheckoutForm.tsx` call `getShippingPriceCents` synchronously inside `useMemo` and re-derive totals as the buyer's country / cart contents change. A DB-backed rate cannot be called from there. Serving it would mean threading a pre-fetched rate snapshot through props from a server component into both trees, and the cart page's shipping total recomputes across an arbitrary set of seller countries — so the snapshot would have to be the whole matrix anyway.
2. **`listing-json-ld.ts` builds `SHIPPING_DETAILS` and `RETURN_POLICY` at module load.** Making rates async turns that into per-request work on the highest-traffic indexed route, and the current shape is a deliberate optimisation.
3. **A DB table adds no historical fidelity we lack.** Orders already snapshot `shipping_cost_cents`, `shipping_net_cents`, `shipping_vat_cents` at creation. Nothing reads a rate retroactively.
4. **Repricing is a coordinated event, not a hotfix.** A 30-day-notice reprice under the Unisend contract requires, at minimum: seller comms, help-page copy review, the JSON-LD `shippingRate` values (which Google has cached), and a cache/ISR revalidation pass. A deploy is the natural coordination point and produces a reviewable, dated, git-blameable record of exactly when the rate changed and who approved it. A DB table would let a rate change silently and would need its own audit event, staff UI, and RLS to be as accountable as a PR already is.

**The counter-argument, stated honestly:** a deploy requires an engineer. If the reprice notice lands during a holiday and rates must change on a fixed date, a static const is a availability risk that a staff-editable table would not have.

**Mitigation, which I recommend building only when the first reprice notice actually arrives:** convert `tariff.ts` to an effective-dated schedule —

```ts
const UNISEND_TARIFF: TariffSchedule = [
  { effectiveFrom: '2025-01-01', matrix: { LT: {...}, LV: {...}, EE: {...} } },
];
```

— so a future reprice can be merged weeks ahead and activates on its own date. That change also requires converting the `listing-json-ld.ts` module-load precompute into a per-request build (otherwise the JSON-LD pins to process boot time and drifts on the transition day). That coupling is exactly why it should not be done speculatively now: it is a real behaviour change and belongs in its own PR with its own justification.

**Not recommended: DB rate table.** It breaks the two synchronous consumers, and the accountability it appears to buy (change tracking) is already provided by git plus the per-order snapshot.

---

## 5. PR breakdown

Six PRs. Each is independently mergeable, behaviour-neutral, and single-concern. `pnpm verify` (`type-check && lint && test && build`) is the gate on all six; the "verify surface" column names what each PR specifically stresses.

### PR 1 — Extract `src/lib/markets/`

**Concern:** the app's supported-markets type stops living inside a carrier module.

Moves `TerminalCountry` → `SupportedCountry`, `TERMINAL_COUNTRIES` → `SUPPORTED_COUNTRIES`, `isTerminalCountry` → `isSupportedCountry`, `PhoneFormat` + `PHONE_FORMATS` into `src/lib/markets/`. Deletes them from `unisend/types.ts` — **no back-compat re-export shim**, since a shim in the carrier module preserves exactly the coupling this PR removes. Replaces `BALTIC_COUNTRIES` in `shipping.ts` and the three `['LT','LV','EE']` literals in `client.ts` with `SUPPORTED_COUNTRIES`. `phone-utils.ts` imports from `@/lib/markets`; `shipping.ts` keeps using `PHONE_FORMATS[destCountry].regex` for the carrier's destination-prefix rule, now via the markets import, with a comment marking it as carrier policy.

Touches 20 source files + 3 test files, all import-line and identifier changes.

*Verify surface:* `type-check` is the real gate (every renamed identifier). Tests exercised: `lib/seo/listing-json-ld.test.ts`, `lib/services/unisend/{types,filter-terminals}.test.ts`, `components/checkout/TerminalPopupContent.test.tsx`.

### PR 2 — Rate seam

**Concern:** rate lookup stops being a compile-time import from a carrier module.

Creates `src/lib/shipping/rates.ts` exporting `quoteShippingCents(origin, destination)` and `quoteMinShippingCents(origin)`. Moves `SHIPPING_PRICES_CENTS` into `providers/unisend/tariff.ts` as `UNISEND_RATES_CENTS` (values byte-identical). Updates the six quote call sites and `listing-json-ld.ts`, which stops reading a raw matrix and instead iterates `SUPPORTED_COUNTRIES × SUPPORTED_COUNTRIES` calling `quoteShippingCents` — still at module load, still synchronous.

`getMinShippingPriceCents` currently throws a `TypeError` on an unknown origin (`Math.min(...Object.values(undefined))`); every call site guards with `isTerminalCountry` first, so it is unreachable. `quoteMinShippingCents` returns `null` instead. That is a defensive change on an unreachable path — call it out in the PR body.

*Verify surface:* new `src/lib/shipping/rates.test.ts` asserting all nine rates and both `null` paths; `lib/seo/listing-json-ld.test.ts` is the neutrality guard and its `expect(byDest.LV).toBe('1.90')` assertions must pass **unmodified**.

### PR 3 — `ShippingProvider` interface, Unisend implementation, registry, resolver

**Concern:** every carrier operation goes through one interface.

Creates `src/lib/shipping/{types,registry,resolve,index}.ts`. Moves `src/lib/services/unisend/**` → `src/lib/shipping/providers/unisend/**` (`types.ts` → `wire-types.ts`, `shipping.ts` → `shipment.ts`, `format-shipping-error.ts` → `format-error.ts`), and adds `providers/unisend/index.ts` implementing `ShippingProvider`. `getTrackingUrl` becomes `buildTrackingUrl` on the provider; `TerminalOption`/`toTerminalOption` become `PickupPoint`/`toPickupPoint` in `lib/shipping/types.ts`. `ShippingContext`/`ShippingResult` get the §3.1 renames.

Consumers move to `getShippingProvider(method)` / `resolveShippingMethod(route)`: `order-transitions.ts` (accept, decline), `order-deadlines.ts` (auto-cancel), `app/api/orders/[id]/retry-shipping/route.ts`, `app/api/terminals/route.ts`, `app/[locale]/checkout/page.tsx`, `app/[locale]/orders/[id]/page.tsx`. `tracking-service.ts` is moved but not yet generalised (PR 5).

*Verify surface:* the four `src/test/scenarios/*.test.ts` files and `order-transitions.test.ts` all `vi.mock('@/lib/services/unisend/shipping', …)` — those mock paths must be repointed, and **the repointing itself is the neutrality evidence**: if the accept/decline/auto-cancel call graph changed shape, the existing assertions in C3/C5, B1/B3, D1/D6, E1–E4 would fail. `build` matters here (route + page graph).

### PR 4 — `shipping_method` as the authoritative discriminator

**Concern:** stop relying on a column default.

Migration `133_shipping_method_not_null.sql`: backfill any `NULL` (expected: zero rows), then `ALTER COLUMN shipping_method SET NOT NULL`, plus a `COMMENT ON COLUMN` naming `src/lib/shipping/registry.ts` as the authority. Adds `shipping_method TEXT NOT NULL DEFAULT 'unisend_t2t'` to `cart_checkout_groups` in the same migration.

`cart-create` and `cart-wallet-pay` call `resolveShippingMethod` and persist it on the group; `createOrder` accepts `shippingMethod` on `CreateOrderParams` and writes it explicitly; `fulfillCartPayment` threads the group's value through. `OrderRow.shipping_method` narrows from `string | null` to `ShippingMethod`. `registry.ts` gains `isKnownShippingMethod`.

Behaviour-neutral because the resolver returns `'unisend_t2t'` for every route that can currently reach order creation (both countries must already be in `SUPPORTED_COUNTRIES` — `validateTerminalInput` rejects otherwise).

*Verify surface:* `src/test/integration/payment-fulfillment.test.ts`, `src/test/scenarios/payment-edges.test.ts`, `src/lib/services/orders.test.ts`; new registry test. Migration applied to staging first per the Safety section of CLAUDE.md.

### PR 5 — `tracking_events` carrier column + provider-agnostic sync loop

**Concern:** the sync loop stops being Unisend-shaped. See §6 for the full migration detail.

Migration `134_tracking_carrier.sql`: add `tracking_events.carrier TEXT NOT NULL DEFAULT 'unisend_t2t'`; replace `add_tracking_event` with an 8-argument version taking `p_carrier`, and `DROP` the 7-argument signature in the same migration (leaving both would create a PostgREST overload ambiguity); add `tracking_sync_state.carrier TEXT` keyed per provider, replacing the `CHECK (id = 1)` single-row constraint.

`tracking-service.ts` → `src/lib/shipping/tracking-sync.ts`: query orders by `shipping_method IN (registry keys)` instead of `.eq('shipping_method','unisend_t2t')`, group by carrier, call `provider.fetchTrackingEvents` per carrier, read/advance that carrier's high-water mark. Auto-transition logic still branches on Unisend literals in this PR — normalising it is PR 6.

*Verify surface:* `type-check`, plus a new `tracking-sync.test.ts` covering the single-provider grouping path. There is no existing test for `syncAllActiveOrders`, which is a gap (§7.3) — write the test in this PR against the current behaviour **before** the loop changes shape, so it is a real guard rather than a description of the new code.

### PR 6 — Normalised tracking vocabulary

**Concern:** display and lifecycle logic stop reading carrier strings.

Adds `src/lib/shipping/tracking-vocabulary.ts` (`ShippingEventCode` + predicates) and `providers/unisend/tracking-map.ts`. `buildOrderTimeline` accepts rows that still carry raw `event_type`/`state_type` **plus** `carrier`, derives the code internally via the carrier's mapper, and `TimelineEntry.key` becomes `OrderMilestone | ShippingEventCode`. `UnifiedTimeline.tsx`'s `LABELS`, `TRACKING_ICONS`, `EVENT_TYPE_OVERRIDES`, `ERROR_KEYS` re-key to codes. `actual-terminal.ts` filters on codes; its Unisend-specific `location` string parser moves to `providers/unisend/` behind a `parsePickupPointFromLocation` hook on the provider. `tracking-sync.ts`'s auto-transitions branch on codes.

*Verify surface:* **`src/components/orders/UnifiedTimeline.test.tsx` is the primary neutrality guard and its 16 assertions on rendered label text must pass unmodified** — that is why the normalisation happens *inside* `buildOrderTimeline` rather than at the DB read, so the component's input row shape is unchanged. `src/lib/orders/timeline.test.ts`'s `result.map(e => e.key)` assertions **do** change (`'PARCEL_RECEIVED'` → `'dropped_off'`), mechanically; its structural assertions (row counts, filtering, dedupe, ETA attachment) must not.

---

## 6. `tracking_events` migration plan

### 6.1 Normalised vocabulary

```ts
export type ShippingEventCode =
  | 'registered'
  | 'dropped_off'
  | 'collected_by_courier'
  | 'in_transit'
  | 'hub_transfer'
  | 'arrived_at_pickup_point'
  | 'pickup_notified'
  | 'picked_up'
  | 'returning'
  | 'cancelled'
  | 'unknown';
```

The granularity is set by what the code currently branches on. It must cover `event_type`-level distinctions, not just `state_type`, or timeline output changes.

Unisend mapping (`(state_type, event_type)` → code), verified against the production fixture in `timeline.test.ts`:

| state_type | event_type | code |
|---|---|---|
| `LABEL_CREATED` | any | `registered` |
| `PARCEL_RECEIVED` | `ACCEPTED_TERMINAL` | `dropped_off` |
| `PARCEL_RECEIVED` | (other) | `dropped_off` |
| `ON_THE_WAY` | `RECEIVED_TERMINAL_OUT` | `collected_by_courier` |
| `ON_THE_WAY` | `RECEIVED_LC`, `DELIVERY_TRANSFER` | `hub_transfer` |
| `ON_THE_WAY` | `RECEIVED_TERMINAL` | `arrived_at_pickup_point` |
| `ON_THE_WAY` | `NOTIFICATIONS_INFORMED` | `pickup_notified` |
| `ON_THE_WAY` | (other) | `in_transit` |
| `PARCEL_DELIVERED` | `DELIVERY_DELIVERED` or any | `picked_up` |
| `RETURNING` | any | `returning` |
| `PARCEL_CANCELED` | any | `cancelled` |
| (unrecognised) | any | `unknown` |

`arrived_at_pickup_point` and `pickup_notified` stay separate codes precisely so the existing dedupe ("hide `NOTIFICATIONS_INFORMED` when `RECEIVED_TERMINAL` exists") survives unchanged. `hasArrivedAtDestination` becomes `code ∈ {picked_up, arrived_at_pickup_point, pickup_notified}` — set-identical to today's predicate. `hub_transfer` is the hidden set. `unknown` falls through to the generic label builder, matching today's behaviour for unmapped `event_type`s (covered by the existing test "unknown granular event_type within ON_THE_WAY: rendered, not filtered").

### 6.2 Storage decision — **derive at read time, do not store `event_code`**

Add **one** column: `carrier TEXT NOT NULL DEFAULT 'unisend_t2t'`. Keep `event_type` and `state_type` as the provider's raw vocabulary. Derive the code in TypeScript at read time via `getShippingProvider(row.carrier).mapTrackingEvent(row)`.

Why not store a normalised `event_code`:

- **No backfill risk.** A stored column needs a SQL `CASE` backfill duplicating the TS map, and the two can silently drift.
- **Mapping bugs are fixable by deploy, not migration.** If we mis-map a Unisend event type, a read-time derivation fixes history for free; a stored column needs a corrective UPDATE over the whole table.
- **The raw vocabulary is the durable record.** Storing only the normalised code loses information; storing both means storing a derivable value, which is the thing that drifts.
- The table is small and always read per-order through an existing index.

The cost is a per-read map lookup on ≤ ~10 rows per order. Not material.

### 6.3 The UNIQUE constraint

`UNIQUE (order_id, state_type, event_timestamp)` **stays exactly as-is** through this whole refactor.

- It is keyed on the provider's raw vocabulary, which is the correct dedupe key for a provider feed. Re-keying it on `event_code` would be strictly worse: `arrived_at_pickup_point` and `pickup_notified` collapse to one code in some future mapper revision and events would start disappearing.
- Adding `carrier` to the key is unnecessary today — `order_id` already pins the carrier, since an order has exactly one shipment (`retryOrderShipping` refuses when `unisend_parcel_id` is set, and cancellation is terminal). If we ever allow re-shipping an order with a different carrier, the key becomes `(order_id, carrier, state_type, event_timestamp)`; that is a separate change with its own behaviour implications.
- The latent collapse described in §1.4 (two `event_type`s sharing a `state_type` and timestamp) is real but pre-existing. Widening to `(order_id, event_type, state_type, event_timestamp)` would make previously-dropped rows appear in the timeline — a genuine behaviour change. **Not in this refactor.** See Q4.

### 6.4 Migration `134_tracking_carrier.sql`

```
1. ALTER TABLE tracking_events ADD COLUMN carrier TEXT NOT NULL DEFAULT 'unisend_t2t';
   -- PG 11+ applies the default without a table rewrite; existing rows are
   -- correct by construction (Unisend has been the only writer since 041).
2. COMMENT ON COLUMN tracking_events.carrier
     IS 'Provider that emitted this event. Values are the keys of SHIPPING_PROVIDERS
         in src/lib/shipping/registry.ts; matches orders.shipping_method.';
3. COMMENT ON COLUMN tracking_events.event_type / .state_type
     IS 'Raw provider vocabulary. Normalised to ShippingEventCode at read time
         via the carrier''s mapper — do not branch on these strings outside
         src/lib/shipping/providers/.';
4. CREATE OR REPLACE FUNCTION public.add_tracking_event(
     p_order_id, p_carrier, p_event_type, p_state_type, p_state_text,
     p_location, p_description, p_event_timestamp)  -- 8 args
     ... SECURITY DEFINER, SET search_path = '', body qualified public.*
     (preserving the 059/061 hardening);
   DROP FUNCTION public.add_tracking_event(uuid,text,text,text,text,text,timestamptz);
5. ALTER TABLE tracking_sync_state DROP CONSTRAINT single_row;
   ALTER TABLE tracking_sync_state ADD COLUMN carrier TEXT;
   UPDATE tracking_sync_state SET carrier = 'unisend_t2t' WHERE id = 1;
   ALTER TABLE tracking_sync_state ALTER COLUMN carrier SET NOT NULL;
   CREATE UNIQUE INDEX tracking_sync_state_carrier_key ON tracking_sync_state(carrier);
```

**Backfill:** none required beyond step 5's single-row `UPDATE`. Every existing `tracking_events` row is Unisend by construction.

**Deploy order (matters):** step 4 drops the 7-arg signature, so the migration and the code change must land together. Apply the migration first, then deploy — between the two, `tracking-sync` calls the 7-arg RPC and gets `PGRST202` (function not found). The sync cron is idempotent and does not advance `last_synced_at` on failure, so a few missed 15-minute ticks are recovered on the next successful run with no event loss. **Confirm on staging that the drop-and-recreate does not leave a stale PostgREST schema cache** (`NOTIFY pgrst, 'reload schema'` if needed).

**Rollback:**

- Steps 1–3: `ALTER TABLE tracking_events DROP COLUMN carrier;` — safe, no reader depends on it once the code is reverted.
- Step 4: re-create the 7-arg function from `061_fix_rpc_search_path_refs.sql` verbatim and drop the 8-arg one.
- Step 5: drop the unique index and the `carrier` column, re-add `CONSTRAINT single_row CHECK (id = 1)`. Only safe while exactly one row exists — true unless a second carrier has already been added, at which point rollback of this migration is not a supported operation anyway.

Write the rollback as `supabase/migrations/rollback/134_down.sql` (not applied) so it is reviewed alongside the forward migration rather than improvised under pressure.

---

## 7. Test strategy

### 7.1 Existing tests that guard behaviour-neutrality

| Test | Guards | PR |
|---|---|---|
| `src/test/scenarios/shipping.test.ts` — C3 seller ships, C4 day-3 reminder, C5 day-5 auto-cancel | `acceptOrder`→`createOrderShipping` wiring; auto-cancel → `cancelOrderShipment`; email/notification fan-out | 3, 4 |
| `src/test/scenarios/seller-response.test.ts` — B1 decline, B2 24h reminder, B3 48h auto-decline | `declineOrder` → cancel-shipment + refund + listing restore ordering | 3 |
| `src/test/scenarios/delivery.test.ts` — D1 buyer confirms, D5 14d reminder, D6 21d auto-escalate + idempotency | shipped→delivered transition and the dispute-escalation path | 3, 6 |
| `src/test/scenarios/completion.test.ts` — E1–E4 | wallet credit, DAC7, double-complete idempotency downstream of shipping | 3 |
| `src/lib/services/order-transitions.test.ts` | `creditSellerWallet` flag-branch contract; also carries the `vi.mock('@/lib/services/unisend/shipping')` stub that must be repointed | 3 |
| `src/components/orders/UnifiedTimeline.test.tsx` (16 rendering assertions) | **the strongest neutrality guard for PR 6** — every rendered label string, the ETA subtitle, the icon geometry. Must pass unmodified. | 6 |
| `src/lib/orders/timeline.test.ts` (26 cases incl. the production-order fixture) | timeline structure: row counts, hidden-event filtering, ready-for-pickup dedupe, ETA attachment/suppression, chronological sort | 6 |
| `src/lib/seo/listing-json-ld.test.ts` | the nine rate values and domestic-vs-cross-border transit times, asserted as literal strings | 2 |
| `src/lib/services/unisend/{types,format-shipping-error,filter-terminals}.test.ts` | error-formatting and terminal-filter behaviour across the file moves | 1, 3 |
| `src/test/integration/payment-fulfillment.test.ts`, `src/test/scenarios/payment-edges.test.ts` | cart fulfilment incl. the mid-loop rollback path that PR 4 threads `shippingMethod` through | 4 |

The four `src/test/scenarios/*` files and `order-transitions.test.ts` all stub `@/lib/services/unisend/shipping` with `vi.mock`. Repointing those paths in PR 3 is the mechanical proof that the call graph shape is unchanged — if `acceptOrder` started calling a different method, or `declineOrder` stopped calling cancel, the existing assertions fail.

### 7.2 New tests required

| PR | Test | Asserts |
|---|---|---|
| 1 | `src/lib/markets/countries.test.ts` | `SUPPORTED_COUNTRIES` is exactly `['LT','LV','EE']`; `isSupportedCountry` accepts those three and rejects `'PL'`, `''`, `'lv'` |
| 1 | `src/lib/markets/phone-formats.test.ts` | each regex accepts its example and rejects the other two countries' examples (locks in today's `PHONE_FORMATS` behaviour before it moves) |
| 2 | `src/lib/shipping/rates.test.ts` | all nine `quoteShippingCents` values verbatim; `quoteMinShippingCents` per origin (190/210/280); `null` for unserved routes |
| 3 | `src/lib/shipping/registry.test.ts` | every `SHIPPING_PROVIDERS` key equals its provider's `.method`; `isKnownShippingMethod` round-trips; each provider satisfies the full interface (compile-time + shape assertion) |
| 3 | `src/lib/shipping/resolve.test.ts` | all 9 Baltic routes → `'unisend_t2t'`; any non-Baltic leg → `null`; **mutual exclusivity** — at most one provider `serves()` any given route (mirrors the `dispatcher.test.ts` convention in the accounting module) |
| 3 | `src/lib/shipping/providers/unisend/index.test.ts` | `buildTrackingUrl` returns today's exact URL for a barcode, `undefined` for empty/whitespace |
| 5 | `src/lib/shipping/tracking-sync.test.ts` | **written against current behaviour before the loop is generalised.** Order selection filter, per-carrier grouping, high-water-mark advance-with-safety-margin, no-advance on fetch failure, unknown-barcode counting |
| 6 | `src/lib/shipping/providers/unisend/tracking-map.test.ts` | every row of the §6.1 table; unmapped `event_type` within `ON_THE_WAY` → `in_transit`; unrecognised `state_type` → `unknown` |
| 6 | `src/lib/shipping/tracking-vocabulary.test.ts` | `isArrivalCode` set-equals `{picked_up, arrived_at_pickup_point, pickup_notified}`; `isHiddenCode` set-equals `{hub_transfer}` |

### 7.3 Gaps

- **`syncAllActiveOrders` has no test at all today.** It is the single largest untested surface this refactor touches. PR 5's test must be written against current behaviour first (see the table) or it is documentation, not a guard.
- **`createOrderShipping` has no test.** Phone normalisation, the destination-prefix rule, the cross-border content-declaration branch, and the empty-barcode partial-success path are all uncovered. Not required for neutrality (the scenario tests stub the whole module), but the destination-prefix rule is exactly the kind of carrier policy that will be got wrong when the second provider lands. Recommend adding a unit test for the pure validation section in PR 3 — flagged as optional scope (Q5).
- **No anon-RLS harness** for `tracking_events` (the known project-wide gap in CLAUDE.md). Migration 134 does not touch the RLS policy, so this refactor does not widen the gap.

---

## 8. Accounting — out of scope, and what a second carrier will require

This refactor writes no journal entries and changes no accounting code. Recording what a second carrier will need, so it is not discovered late:

1. **A new `5410-*` accrual sub-account.** `5410-UN` ("Uzkrātās piegādes izmaksas" / accrued shipping, parent `5410`) is seeded in migration 096. A second carrier needs its own sub-account, added by migration **and** appended to `ACCRUAL_SUB_ACCOUNTS` in `src/lib/accounting/checklist.ts` — that array is hardcoded `['5410-UN','5410-EP']` and drives period-close checklist item 6 ("Accruals cleared, sum of `5410-*` closing = 0"). A missing entry silently excludes the new carrier's accrual from the close gate.
2. **A new counterparty row.** Vendor counterparties are lazily resolved; the second carrier needs one with the correct `country` and `tax_status`, since that drives VAT routing.
3. **A second I.1 vendor-invoice stream.** Per the v1.4 completion-entry signoff there is **no per-order shipping accrual** — Unisend cost is recognised only at monthly invoice receipt through the existing I.1 flow. So a second carrier adds a second monthly invoice to intake, and nothing changes in the O.x order-completion entries. This is the main reason the accounting blast radius is small.
4. **VAT routing depends on the carrier's jurisdiction.** A non-LV EU carrier routes through the reverse-charge types (I.2 / I.4) rather than I.1; a non-EU carrier through I.3 with its own treatment. Confirm with the accountant before the first invoice, not after.
5. **Revenue side unchanged.** Buyer-funded shipping is STG revenue on `6310-S` regardless of who carries the parcel, and `shipping_net_cents` / `shipping_vat_cents` are already snapshotted per order at creation from the quoted rate.

---

## 9. Explicit non-goals / dependencies

- **Label-print-at-home is out of scope and is a hard dependency for any non-locker carrier.** The entire fulfilment surface assumes terminal-to-terminal with a barcode: `BarcodeCard`, `OrderStageHelper`'s "Ship your parcel / drop at any compatible parcel locker" copy, `LockerFinder`, the `shipping-instructions-seller` email and its subject line, and the `PickupPoint`-shaped destination on both `orders` and `cart_checkout_groups`. `ShippingProvider` as specified has no label-artifact concept (no PDF buffer, no storage path, no print state). Adding one is a separate design with its own storage, RLS, and email work.
- **No second carrier is implemented.** `ShippingMethod` stays a one-member union until a real provider lands, so the type system flags every switch that needs a new arm.
- **User-facing copy naming Unisend is unchanged** (help pages, packing guide, `TrustBand` logo, seller email). That is a content decision, not a refactor.
- **`memory/shipping_architecture.md` is now stale** and should be updated in PR 6 — it still describes `types.ts` as owning the price matrix and `PHONE_FORMATS`.
- **Env/CSP namespacing deferred.** `env.unisend.*` and the `https://*.unisend.com` `connect-src` entry stay as-is; restructuring `env` into `env.shipping.providers.unisend.*` is churn with no benefit until there is a second entry.

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| PR 3's file moves are large; a stale `vi.mock` path silently no-ops and a test passes for the wrong reason | High | Vitest errors on `vi.mock` of a non-existent module, so a stale path fails loudly rather than silently. Still: grep for `services/unisend` across `src/` after PR 3 and assert zero hits. |
| PR 6 changes `TimelineEntry.key`'s union; `timeline.test.ts` assertions change in the same PR, weakening it as a guard | High | Neutrality evidence shifts to `UnifiedTimeline.test.tsx`, whose input rows and rendered-string assertions must be **untouched**. If any of its 16 assertions need editing, the refactor is not neutral — stop and reassess. |
| Migration 134 drops an RPC signature; PostgREST schema-cache lag causes a window of failing sync ticks | Medium | The sync cron does not advance `last_synced_at` on failure, so events are recovered on the next tick. Apply to staging first; `NOTIFY pgrst, 'reload schema'` if the cache lags. |
| PR 4's `SET NOT NULL` fails if any production row has a NULL `shipping_method` | Medium | The column has had a DEFAULT since migration 002 and is never explicitly set to NULL, so zero rows expected — but the migration backfills before the constraint, and the count is verified on staging first. |
| `listing-json-ld.ts`'s module-load precompute is fragile under any future async rate source | Medium | Documented in §4 as the blocking coupling for the effective-dated tariff. Add a comment at the precompute marking it. |
| Renaming `TerminalCountry` → `SupportedCountry` across 20 files collides with in-flight branches | Low | Sequence PR 1 first and merge it quickly; it is pure rename and reviews fast. |
| `resolveShippingMethod` returning `null` reaches a call site that previously got a number | Low | `getShippingPriceCents` already returns `null` on unknown routes and every caller already handles it (`?? 0` or a null-check). PR 2's tests pin both null paths. |

---

## 11. Open questions — need your answers before implementation

**Q1 — `resolveShippingMethod` signature.** I propose `{ originCountry, destinationCountry }` (see §3.2). You specified destination-derived. Do you want the narrower `resolveShippingMethod(destinationCountry)`, accepting that rate lookup then needs a second origin parameter threaded separately?

**Q2 — CHECK constraint on `orders.shipping_method`.** I recommend registry-only, no DB CHECK (§3.3). Confirm, or say you want the CHECK and I will add it with the migrate-before-deploy ordering note.

**Q3 — Rate storage.** I recommend a static const, with the effective-dated schedule deferred until the first reprice notice arrives (§4). Confirm, or tell me you want the effective-dated structure built now — in which case the JSON-LD per-request conversion joins PR 2 and PR 2 stops being behaviour-neutral.

**Q4 — The latent UNIQUE-key collapse** (§1.4, §6.3). Leave as-is in this refactor, and file a separate behaviour-changing PR to widen the key to include `event_type`? Or do you want it left alone permanently?

**Q5 — `createOrderShipping` unit test.** Currently untested (§7.3). Add a test for its pure validation section in PR 3 (roughly +1 file, +80 lines, no production-code change), or leave the gap?

**Q6 — PR sequencing.** Six PRs merged in order 1→6, or would you rather I bundle 1+2 (both are pure moves, ~25 files total) to reduce review round-trips?

**Q7 — `TerminalOption` → `PickupPoint` rename.** It touches nine component files for a name change with no functional content. Worth it for the provider-neutral vocabulary, or keep `TerminalOption` and accept the terminology debt?

---

*No source files were written. No branch was created (`claude/carrier-provider-abstraction-44rvsk` was already checked out). Awaiting sign-off.*
