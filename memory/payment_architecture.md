---
name: Payment Architecture
description: EveryPay integration decisions, wallet design, refund rules, and pricing model
type: project
---

## Pricing Model

- Buyer pays: item price + shipping (no service fee)
- Seller commission: 10% flat on item price only (NOT shipping)
- All amounts stored and calculated as INTEGER CENTS (never floats)
- VAT rates by seller's country: LV=21%, LT=21%, EE=24%
- VAT is inclusive in all displayed prices

## Payment Flow

1. Calculate total (items + shipping)
2. Check buyer wallet balance
3. If wallet covers all → debit wallet, create order instantly
4. If wallet partial → debit wallet, EveryPay for remainder
5. If no wallet → full EveryPay payment
6. EveryPay callback → verify payment → create order → send emails

## Wallet Design

- Wallet uses INTEGER cents (not DECIMAL euros) for precision
- Seller wallet credited AFTER 2-day dispute window post-delivery
- All wallet mutations via Postgres RPCs for atomicity (prevent race conditions)
- IBAN collected at first withdrawal, not during onboarding

## EveryPay Integration

- Swedbank payment gateway for Baltic region
- Supports card payments + bank links (Swedbank, SEB, Luminor, etc.)
- HTTP Basic Auth with api_username:api_secret
- Callback handler is idempotent (checks everypay_payment_reference on orders table)
- Auto-refund if order creation fails after successful payment

### Implementation (src/lib/services/everypay/)
- `client.ts` — HTTP wrapper: createPayment, getPaymentStatus, refundPayment, capturePayment, voidPayment, getPaymentMethods
- `types.ts` — SUCCESSFUL_STATES (authorised, settled), FAILED_STATES, PENDING_STATES, all request/response interfaces
- `classify-error.ts` — classifyPaymentError() maps EveryPay errors to 6 user-facing categories (fraud_declined, card_declined, auth_failed, technical_error, user_cancelled, payment_failed)
- Uses `env.everypay` from `src/lib/env.ts` for credentials (apiUrl, apiUsername, apiSecret, accountName)
- EveryPayError class with optional code and response for debugging

### Checkout Flow
1. POST /api/payments/create — validates listing, calculates shipping via Unisend SHIPPING_PRICES, calls createPayment(), returns paymentLink
2. Browser redirects to EveryPay hosted payment page
3. GET /api/payments/callback — EveryPay redirects here with payment_reference + order_reference
4. Callback verifies with getPaymentStatus(), checks SUCCESSFUL_STATES, creates order, updates listing to 'reserved'
5. Order reference encoding: base64({listingId}:{buyerId}) — may need migration to UUID if EveryPay rejects format

## Refund Rules

- Pre-completion (before seller wallet credit): reverse wallet debit + EveryPay refund
- Post-completion (after wallet credit): claw back from seller wallet + refund buyer
- Bank link payments require manual SEPA refund after API call
- Refund claims use atomic check: `is('refund_status', null)` to prevent double refunds

## Order State Machine

```
pending_seller → accepted → shipped → delivered → completed
    ↓              ↓           ↓          ↓
 cancelled     cancelled   cancelled   disputed → resolved
```

## Invoicing Model

- Shipping = logistics service provided TO the seller (funded by buyer at checkout)
- Platform services invoice to seller: commission + shipping as 2 separate line items
- VAT follows seller's country for BOTH lines (Article 46 for commission, Article 50 for shipping)
- STG acts as commercial agent under PSD2 Article 3(b)

## Key Principle

Orders are ONLY created after payment is confirmed. There is no `pending_payment` status. This eliminates an entire class of "payment failed but order exists" bugs.
