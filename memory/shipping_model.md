---
name: Shipping Model
description: Unisend parcel locker integration, route-based pricing, Baltic cross-border shipping
type: project
---

## Unisend Integration

- **Service:** Parcel locker shipping via Unisend API
- **Coverage:** All three Baltic countries (LV, LT, EE) including cross-border routes
- **Selection:** Terminal/locker selector at checkout with Maplibre map
- **Key files:** `lib/unisend/` for API client, `components/ui/map/` for terminal map

## Shipping Pricing

- Route-based pricing (not weight-based) — price depends on origin/destination country pair
- Shipping cost passed directly to buyer (platform takes no margin on shipping)
- Shipping is a logistics service provided TO the seller (funded by buyer at checkout)
- Constants defined in `lib/pricing/constants.ts`

## Checkout Flow with Shipping

1. Buyer adds items to cart (reservation timer locks items)
2. Terminal/locker selection via map interface
3. Shipping cost calculated by route (seller country → buyer country)
4. Total = items + shipping
5. Wallet balance applied automatically if available
6. EveryPay redirect for remaining amount (card/bank links)

## Invoicing

- Platform invoices seller for: commission (10% of items) + shipping cost = 2 separate line items
- VAT follows seller's country for BOTH lines:
  - Commission: Article 46 (electronically supplied service)
  - Shipping: Article 50 (transport service)
- VAT rates: LV=21%, LT=21%, EE=24%

## Environment Variables

```
UNISEND_API_URL=https://api.unisend.com
UNISEND_USERNAME=your-username
UNISEND_PASSWORD=your-password
```
