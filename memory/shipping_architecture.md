---
name: Shipping Architecture
description: Unisend parcel locker integration — shipping prices, terminal API, parcel creation, tracking sync
type: project
---

## Overview

Unisend Terminal-to-Terminal (T2T) shipping for Baltic states (LT, LV, EE). Parcels go from seller's nearest Unisend terminal to buyer's chosen terminal.

## Implementation (src/lib/services/unisend/)

- `types.ts` — All types, SHIPPING_PRICES matrix, getShippingPrice(), PHONE_FORMATS, parcel sizes, error classes, UI helpers
- `client.ts` — OAuth token management (in-memory + cache fallback), all API methods
- `label-service.ts` — generateShippingLabel(), updateOrderWithShippingData(), getTrackingUrl()
- `tracking-service.ts` — syncTrackingForOrder(), syncAllActiveOrders() (cron)
- `prepare-and-generate-label.ts` — Shared workflow for accept/retry-label routes (phone normalization, validation, label gen, email)
- `format-label-error.ts` — User-friendly error formatting from UnisendValidationError

## Shipping Price Matrix (EUR)

```
From\To   LT     LV     EE
LT       2.70   2.50   2.70
LV       2.10   1.90   2.10
EE       3.50   3.20   2.80
```

- `getShippingPrice(senderCountry, receiverCountry)` returns EUR float or null
- Convert to cents for storage: `Math.round(price * 100)`
- Prices are the same regardless of parcel size

## Token Management

- OAuth with username/password in query params
- 3-level cache: in-memory → cache module → API
- Token expires 60s early for safety
- 401 triggers automatic re-authentication (1 retry)

## Terminal API

- `getTerminals(country)` — cached 1 hour
- `getAllTerminals()` — combines LT/LV/EE
- Terminal data includes: id, name, city, address, postalCode, boxes (available sizes), coordinates, hours

## Parcel Sizes

- XS: 38x14x64 cm, 10 kg
- S: 38x19x64 cm, 20 kg
- M: 38x39x64 cm, 30 kg (default for board games)
- L: 35x61x74 cm, 30 kg

## Label Generation Flow

1. Seller accepts order → prepareAndGenerateLabel()
2. Normalize buyer/seller phones via phone-utils
3. Validate phones against destination country format (PHONE_FORMATS)
4. Create parcel + initiate shipping via Unisend API
5. Store parcelId, barcode, trackingUrl on order
6. Label URL: `unisend://terminal/{parcelId}` (seller prints at terminal)
7. Send email to seller (stub for now)

## Tracking Sync (cron)

- syncAllActiveOrders() fetches all T2T orders with barcodes in active statuses
- Calls Unisend tracking API per order
- Inserts events via `add_tracking_event` RPC
- 200ms delay between API calls to avoid rate limiting

## Dependencies

- `src/lib/cache.ts` — in-memory cache with TTL (no Redis)
- `src/lib/phone-utils.ts` — Baltic phone detection, composition, validation
- `src/lib/email/stubs.ts` — no-op email functions until email service built

## Phone Formats

- LT: +3706XXXXXXX
- LV: +3712XXXXXXX
- EE: +3725XXXXXX or +3725XXXXXXX
