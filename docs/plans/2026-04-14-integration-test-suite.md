# Integration Test Suite Design

## Context

47 pre-launch test scenarios exist (`.claude/plans/noble-plotting-stonebraker.md`) covering order lifecycle, payment edge cases, refunds, auctions, and cron enforcement. Currently all 323 tests are unit tests with mocked Supabase. No integration tests exist against a real database — a gap noted in CLAUDE.md.

This design covers automating 31 of the 47 scenarios using a hybrid approach: mock-based tests for business logic + real Supabase (local) for database-level behavior (RPCs, constraints, locks).

## Approach

**Mock-based** (`src/test/scenarios/`) — Test state transitions, refund math, deadline logic by mocking the Supabase client. Fast, no infrastructure. ~18 tests.

**Integration** (`src/test/integration/`) — Test wallet RPCs, reservation atomicity, payment uniqueness, expire_stale_reservations against local Supabase via `supabase start`. ~12 tests.

**Manual** (stays in checklist) — Real EveryPay payments, Unisend parcel creation, notification visual checks, mobile UI, cross-border shipping. ~16 scenarios.

## Structure

```
src/test/
  setup.ts                          # Global setup: verify local Supabase, reset DB
  helpers/
    supabase.ts                     # Test clients (service + anon) against localhost:54321
    factories.ts                    # createTestUser/Listing/Order/Wallet/Auction
    cron.ts                         # callCron(name) — builds Request, calls handler
    assertions.ts                   # assertOrderStatus/WalletBalance/TransactionExists
    mock-supabase.ts                # Mock Supabase builder for scenario tests
  integration/
    wallet-rpcs.test.ts             # 5 tests: idempotency, insufficient balance, atomicity, withdrawal cycle, concurrent race
    reservation-race.test.ts        # 2 tests: concurrent reserve, reservation + order_items check
    expire-reservations.test.ts     # 3 tests: stale expires, active order blocks, cancelled order expires
    payment-fulfillment.test.ts     # 2 tests: duplicate payment ref, cart group mutex
  scenarios/
    seller-response.test.ts         # B1-B3: decline, 24h reminder, 48h auto-decline
    shipping.test.ts                # C1-C5: accept, retry, ship, day 3 reminder, day 5 cancel
    delivery.test.ts                # D1-D6: confirm, auto-deliver, return, reminder, auto-escalate
    completion.test.ts              # E1-E4: complete, auto-complete, idempotency, DAC7
    auctions.test.ts                # G1-G6: end w/ bids, no bids, reminder, deadline, tamper, losers
    payment-edges.test.ts           # I2-I11: orphan reconciliation, unavailable items, wallet debit fail, reservation expiry, duplicate callback
    refunds.test.ts                 # J1-J6: card/wallet/split, partial failure, idempotency
```

## Test Helpers

### `src/test/helpers/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const TEST_URL = process.env.SUPABASE_TEST_URL ?? 'http://localhost:54321';
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? '<from supabase status>';
const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? '<from supabase status>';

export function createTestServiceClient() {
  return createClient(TEST_URL, TEST_SERVICE_KEY);
}

export function createTestAnonClient() {
  return createClient(TEST_URL, TEST_ANON_KEY);
}
```

### `src/test/helpers/factories.ts`

Each factory creates real rows via service client (integration) or returns plain objects (mock).

```typescript
createTestUser({ country?: string, fullName?: string }) → user_profiles row
createTestListing({ sellerId, priceCents?, country?, listingType? }) → listings row
createTestOrder({ buyerId, sellerId, items, status?, createdAt? }) → orders + order_items
createTestWallet({ userId, balanceCents? }) → wallets row
createTestAuction({ sellerId, startingPriceCents, endAt }) → listings row (auction type)
```

Build variants for mock-based tests (no DB):
```typescript
buildTestOrder({ ...overrides }) → order object (not inserted)
buildTestListing({ ...overrides }) → listing object
```

### `src/test/helpers/cron.ts`

```typescript
export async function callCron(name: string): Promise<Response> {
  const { POST } = await import(`@/app/api/cron/${name}/route`);
  const request = new Request(`http://localhost:3000/api/cron/${name}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? 'test-cron-secret'}` },
  });
  return POST(request);
}
```

### `src/test/helpers/assertions.ts`

For integration tests — reads real DB state:

```typescript
assertOrderStatus(orderId: string, expected: string)
assertWalletBalance(userId: string, expectedCents: number)
assertTransactionExists(orderId: string, type: 'credit' | 'debit' | 'refund')
assertTransactionNotExists(orderId: string, type: string)
assertListingStatus(listingId: string, expected: string)
```

## Scenario Test Details

### Seller Response (B1-B3)

| ID | Scenario | Setup | Action | Assert |
|----|----------|-------|--------|--------|
| B1 | Seller declines | Order `pending_seller` | Call decline handler | Status `cancelled`, reason `declined`, refund called, listing `active` |
| B2 | 24h reminder | Order `pending_seller`, created 25h ago | Call `enforce-deadlines` | Reminder sent, `deadline_reminder_sent_at` set |
| B3 | 48h auto-decline | Order `pending_seller`, created 49h ago | Call `enforce-deadlines` | Status `cancelled`, reason `response_timeout`, refund called |

### Shipping (C1-C5)

| ID | Scenario | Setup | Action | Assert |
|----|----------|-------|--------|--------|
| C1 | Unisend fails on accept | Order `pending_seller`, Unisend mock throws | Call accept handler | Status `accepted`, retry button available |
| C3 | Seller ships | Order `accepted` | Call ship handler | Status `shipped`, `deadline_reminder_sent_at` null |
| C4 | Day 3 reminder | Order `accepted`, accepted 4d ago | Call `enforce-deadlines` | Reminder sent |
| C5 | Day 5 auto-cancel | Order `accepted`, accepted 6d ago | Call `enforce-deadlines` | Status `cancelled`, reason `shipping_timeout` |

### Delivery (D1-D6)

| ID | Scenario | Setup | Action | Assert |
|----|----------|-------|--------|--------|
| D1 | Buyer confirms | Order `shipped` | Call deliver handler | Status `delivered` |
| D3 | Tracking return event | Order `shipped`, tracking RETURNING | Call `sync-tracking` | Status `disputed`, dispute created |
| D5 | 14d reminder | Order `shipped`, shipped 15d ago | Call `enforce-deadlines` | Reminder sent |
| D6 | 21d auto-escalate | Order `shipped`, shipped 22d ago | Call `enforce-deadlines` | Status `disputed`, dispute created |

### Completion (E1-E4)

| ID | Scenario | Setup | Action | Assert |
|----|----------|-------|--------|--------|
| E1 | Buyer completes | Order `delivered` | Call complete handler | Status `completed`, wallet credit = 90% of items |
| E2 | Auto-complete | Order `delivered`, delivered 3d ago | Call `auto-complete` | Same as E1 |
| E3 | Double-complete | Order `completed` | Call complete again | No-op, wallet credited once |
| E4 | DAC7 threshold | Seller near threshold | Complete order | `upsert_dac7_seller_stats` called |

### Auctions (G1-G6)

| ID | Scenario | Setup | Action | Assert |
|----|----------|-------|--------|--------|
| G1 | Ends with bids | Active auction, past end time, has bids | Call `end-auctions` | Status `auction_ended`, winner notified |
| G2 | Ends no bids | Active auction, past end time, 0 bids | Call `end-auctions` | Status `cancelled` |
| G3 | 12h reminder | `auction_ended`, 12h remaining | Call `auction-payment-deadline` | Reminder sent |
| G4 | 24h no payment | `auction_ended`, 24h+ elapsed | Call `auction-payment-deadline` | Status `cancelled` |
| G5 | Price tamper | Auction checkout | Submit lower price in body | Server uses `current_bid_cents`, ignores client |
| G6 | Losers notified | Auction with 3 bidders | Call `end-auctions` | 2 losing bidders notified |

### Payment Edge Cases (I2-I11)

| ID | Scenario | Setup | Action | Assert |
|----|----------|-------|--------|--------|
| I2 | Orphan reconciliation | Cart group pending 5+ min, EveryPay mock returns settled | Call `reconcile-payments` | Order created |
| I3 | Listing unavailable at fulfillment | Payment succeeded, listing status changed | Call fulfillment | Auto-refund triggered |
| I5 | All items unavailable | All listings sold | Call fulfillment | Full refund, no orders |
| I6 | Wallet debit fails | Wallet debit mock throws | Call fulfillment | Order created, `buyer_wallet_debit_cents=0` |
| I8 | Reservation expiry | Reserved listing, no order, past TTL | Call `expire-reservations` | Listing `active` |
| I9 | Payment declined | EveryPay returns failed | Check redirect | No order, no reservation |
| I11 | Duplicate callback | Call callback twice same ref | Second call | Redirect to existing order, no duplicate |

### Refunds (J1-J6)

| ID | Scenario | Setup | Action | Assert |
|----|----------|-------|--------|--------|
| J1 | Card-only refund | Order paid by card only | Trigger refund | EveryPay refund called with full amount |
| J2 | Wallet-only refund | Order paid by wallet only | Trigger refund | Wallet balance restored |
| J3 | Split refund | Order paid card + wallet | Trigger refund | Both legs processed, amounts match split |
| J4 | Partial failure | EveryPay refund fails | Trigger refund | `refund_status = 'PARTIAL'` |
| J6 | Double refund | Order already refunded | Trigger refund again | Early bail on `refund_status = 'COMPLETED'` |

## Integration Test Details

### `wallet-rpcs.test.ts` (5 tests)

1. **Credit idempotency**: Create user + wallet → call `wallet_credit` with order A → call again → one transaction, correct balance
2. **Debit insufficient**: Create wallet with 500 → call `wallet_debit` for 1000 → exception, balance still 500
3. **Debit atomicity**: Credit 1000 → debit 1000 → balance 0, two transactions
4. **Withdrawal cycle**: Create wallet 5000 → insert withdrawal_request → `wallet_withdrawal_debit` → `wallet_withdrawal_credit_back` → balance restored to 5000
5. **Concurrent credit**: Two parallel `wallet_credit` calls for same order_id → UNIQUE constraint, one transaction exists

### `reservation-race.test.ts` (2 tests)

1. **Concurrent reserve**: Create listing → two parallel `reserve_listings_atomic` calls → one returns empty (success), one returns the listing ID (failed)
2. **Reservation with order_items**: Reserve listing → create order with order_items → call `expire_stale_reservations` with old cutoff → listing stays reserved

### `expire-reservations.test.ts` (3 tests)

1. **Stale no order**: Reserve listing, no order → call RPC with cutoff after reservation → listing `active`
2. **Active order blocks**: Reserve + create order_items with active order → call RPC → listing stays `reserved`
3. **Cancelled order allows**: Reserve + create order_items with cancelled order → call RPC → listing `active`

### `payment-fulfillment.test.ts` (2 tests)

1. **Duplicate payment ref**: Create two orders with same `everypay_payment_reference` → UNIQUE constraint error
2. **Cart group mutex**: Create cart group `pending` → UPDATE to `completing` → second UPDATE returns 0 rows

## Configuration

### `vitest.integration.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['src/test/integration/**/*.test.ts'],
    globalSetup: 'src/test/setup.ts',
    testTimeout: 15_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: { DOTENV_CONFIG_PATH: '.env.test' },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

### `package.json` scripts

```json
{
  "test": "vitest run",
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:all": "vitest run && vitest run --config vitest.integration.config.ts"
}
```

### `.env.test`

```
SUPABASE_TEST_URL=http://localhost:54321
SUPABASE_TEST_ANON_KEY=<from supabase status>
SUPABASE_TEST_SERVICE_ROLE_KEY=<from supabase status>
CRON_SECRET=test-cron-secret
```

### Prerequisites

```bash
# One-time: install Supabase CLI
brew install supabase/tap/supabase

# Before running integration tests:
supabase start          # Starts local Postgres + Auth (Docker)
supabase db reset       # Applies all 71 migrations

# Run tests:
pnpm test:integration
```

## Implementation Order

1. **Helpers first**: supabase.ts, factories.ts, cron.ts, assertions.ts, mock-supabase.ts
2. **Integration tests**: wallet-rpcs → reservation-race → expire-reservations → payment-fulfillment
3. **Scenario tests Tier 1**: seller-response → shipping → delivery → completion
4. **Scenario tests Tier 2**: auctions → payment-edges → refunds
5. **Config + scripts**: vitest.integration.config.ts, .env.test, package.json scripts

## Coverage Summary

| Category | Scenarios | Automated | Manual |
|----------|-----------|-----------|--------|
| A. Happy path | 5 | 1 (A2 wallet-only, via integration) | 4 (need real EveryPay) |
| B. Seller response | 3 | 3 | 0 |
| C. Shipping | 5 | 4 | 1 (C2 real Unisend retry) |
| D. Delivery | 6 | 4 | 2 (D2, D4 real tracking) |
| E. Completion | 4 | 4 | 0 |
| F. Disputes | 9 | 0 (Tier 3, deferred) | 9 |
| G. Auctions | 6 | 6 | 0 |
| H. Offers | 4 | 0 (Tier 3, deferred) | 4 |
| I. Payment edges | 11 | 9 | 2 (I1 browser race, I10 3DS) |
| J. Refunds | 6 | 5 | 1 (J5 total failure is edge) |
| K. Comments | 3 | 0 (Tier 3, deferred) | 3 |
| L. Notifications | 1 checklist | 0 | 1 (visual check) |
| **Total** | **63 items** | **~36** | **~27** |
