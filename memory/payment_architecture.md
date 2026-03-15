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
- Store checkout metadata in webhook events table BEFORE redirect
- Callback handler is idempotent (checks processed_at)
- Auto-refund if order creation fails after successful payment

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
